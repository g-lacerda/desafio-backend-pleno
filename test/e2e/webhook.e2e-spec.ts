import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { IdempotencyStatus, OrderStatus, PrismaClient } from '@prisma/client';
import request from 'supertest';
import { bootstrapTestApp } from '../helpers/test-app';

interface OrderPayloadOverrides {
  order_id?: string;
  customer?: { email?: string; name?: string };
  items?: Array<{ sku: string; qty: number; unit_price: number }>;
  currency?: string;
  idempotency_key?: string;
}

const buildPayload = (overrides: OrderPayloadOverrides = {}) => ({
  order_id: overrides.order_id ?? `ext-${randomUUID().slice(0, 8)}`,
  customer: {
    email: overrides.customer?.email ?? 'user@example.com',
    name: overrides.customer?.name ?? 'Ana Silva',
  },
  items: overrides.items ?? [{ sku: 'ABC123', qty: 2, unit_price: 59.9 }],
  currency: overrides.currency ?? 'USD',
  idempotency_key: overrides.idempotency_key ?? randomUUID(),
});

describe('Webhook /webhooks/orders (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    app = await bootstrapTestApp();
    const { PrismaService } = await import('@/shared/database/prisma.service');
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('payload válido', () => {
    it('aceita pedido, retorna 202 e persiste Order com status RECEIVED', async () => {
      const payload = buildPayload({ order_id: `ext-${randomUUID().slice(0, 8)}` });
      const res = await request(app.getHttpServer()).post('/webhooks/orders').send(payload);

      expect(res.status).toBe(202);
      expect(res.body.id).toEqual(expect.any(String));
      expect(res.body.external_order_id).toBe(payload.order_id);
      expect(res.body.status).toBe('RECEIVED');
      expect(res.body.total_original).toBe('119.80');
      expect(res.body.items[0].unit_price).toBe('59.90');

      const persisted = await prisma.order.findUnique({ where: { id: res.body.id } });
      expect(persisted).not.toBeNull();
      // Pode ter sido enriquecido entre o webhook e a leitura aqui (worker rápido + nock 200).
      expect([OrderStatus.RECEIVED, OrderStatus.ENRICHING, OrderStatus.ENRICHED]).toContain(
        persisted?.status,
      );
      expect(persisted?.totalOriginalCents).toBe(11980);

      const idemRecord = await prisma.idempotencyKey.findUnique({
        where: { key: payload.idempotency_key },
      });
      expect(idemRecord?.status).toBe(IdempotencyStatus.COMPLETED);
      expect(idemRecord?.orderId).toBe(res.body.id);
    });
  });

  describe('idempotência', () => {
    it('replay: mesma chave + mesmo payload → devolve resposta original sem criar Order duplicado', async () => {
      const payload = buildPayload();
      const first = await request(app.getHttpServer()).post('/webhooks/orders').send(payload);
      expect(first.status).toBe(202);

      const second = await request(app.getHttpServer()).post('/webhooks/orders').send(payload);
      expect(second.status).toBe(202);
      expect(second.body).toEqual(first.body);

      const count = await prisma.order.count({
        where: { externalOrderId: payload.order_id },
      });
      expect(count).toBe(1);
    });

    it('hash divergente: mesma chave + payload diferente → 422', async () => {
      const key = randomUUID();
      const first = await request(app.getHttpServer())
        .post('/webhooks/orders')
        .send(buildPayload({ idempotency_key: key }));
      expect(first.status).toBe(202);

      const second = await request(app.getHttpServer())
        .post('/webhooks/orders')
        .send(buildPayload({ idempotency_key: key, customer: { email: 'other@example.com' } }));

      expect(second.status).toBe(422);
      expect(second.body.message).toContain(key);
    });
  });

  describe('validação', () => {
    it('payload sem customer.email → 400', async () => {
      const payload = buildPayload();
      delete (payload.customer as Partial<typeof payload.customer>).email;

      const res = await request(app.getHttpServer()).post('/webhooks/orders').send(payload);
      expect(res.status).toBe(400);
      expect(Array.isArray(res.body.message)).toBe(true);
    });

    it('items vazio → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/webhooks/orders')
        .send(buildPayload({ items: [] }));
      expect(res.status).toBe(400);
    });

    it('unit_price com 3 decimais → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/webhooks/orders')
        .send(buildPayload({ items: [{ sku: 'X', qty: 1, unit_price: 9.999 }] }));
      expect(res.status).toBe(400);
    });

    it('unit_price negativo → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/webhooks/orders')
        .send(buildPayload({ items: [{ sku: 'X', qty: 1, unit_price: -1 }] }));
      expect(res.status).toBe(400);
    });

    it('unit_price acima do limite → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/webhooks/orders')
        .send(buildPayload({ items: [{ sku: 'X', qty: 1, unit_price: 1_000_001 }] }));
      expect(res.status).toBe(400);
    });
  });

  describe('i18n nos erros', () => {
    it.each([
      ['en', /must be a valid email/i],
      ['pt-BR', /e-mail v[áa]lido/i],
      ['es', /correo electr[óo]nico v[áa]lido/i],
    ])('payload inválido com Accept-Language=%s → mensagem traduzida', async (lang, regex) => {
      const payload = buildPayload({ customer: { email: 'not-an-email' } });
      const res = await request(app.getHttpServer())
        .post('/webhooks/orders')
        .set('Accept-Language', lang)
        .send(payload);

      expect(res.status).toBe(400);
      const messages: string[] = Array.isArray(res.body.message)
        ? res.body.message
        : [res.body.message];
      expect(messages.some((m) => regex.test(m))).toBe(true);
    });

    it.each([
      ['en', /already been used/i],
      ['pt-BR', /já foi usada/i],
      ['es', /ya fue utilizada/i],
    ])(
      'hash divergente com Accept-Language=%s → mensagem traduzida',
      async (lang, regex) => {
        const key = randomUUID();
        await request(app.getHttpServer())
          .post('/webhooks/orders')
          .send(buildPayload({ idempotency_key: key }));

        const second = await request(app.getHttpServer())
          .post('/webhooks/orders')
          .set('Accept-Language', lang)
          .send(buildPayload({ idempotency_key: key, customer: { email: 'b@b.com' } }));

        expect(second.status).toBe(422);
        expect(second.body.message).toMatch(regex);
      },
    );
  });
});
