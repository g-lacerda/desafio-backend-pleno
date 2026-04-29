import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { Language, OrderStatus, PrismaClient } from '@prisma/client';
import request from 'supertest';
import { ADMIN_KEY, bootstrapTestApp, postWebhook } from '../helpers/test-app';

const buildOrderPayload = () => ({
  order_id: `ext-${randomUUID().slice(0, 8)}`,
  customer: { email: 'u@e.com', name: 'Ana' },
  items: [{ sku: 'X', qty: 1, unit_price: 10 }],
  currency: 'USD',
  idempotency_key: randomUUID(),
});

interface DemoUser {
  language: Language;
  apiKey: string;
}

describe('Orders consultation (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let userPt: DemoUser;
  let userEn: DemoUser;
  let userEs: DemoUser;

  const createUser = async (language: Language, suffix: string): Promise<DemoUser> => {
    const res = await request(app.getHttpServer())
      .post('/users')
      .set('X-Admin-Key', ADMIN_KEY)
      .send({
        email: `demo-${suffix}-${Date.now()}-${randomUUID().slice(0, 4)}@inbazz.com`,
        name: `Demo ${language}`,
        password: 'demo-pass-1234',
        preferredLanguage: language,
      });
    return { language, apiKey: res.body.api_key };
  };

  beforeAll(async () => {
    app = await bootstrapTestApp();
    const { PrismaService } = await import('@/shared/database/prisma.service');
    prisma = app.get(PrismaService);

    [userPt, userEn, userEs] = await Promise.all([
      createUser(Language.PT_BR, 'pt'),
      createUser(Language.EN, 'en'),
      createUser(Language.ES, 'es'),
    ]);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('GET /orders', () => {
    let createdId: string;

    beforeAll(async () => {
      const res = await postWebhook(app).send(buildOrderPayload());
      createdId = res.body.id;
    });

    it('lista pedidos com paginação default', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${userEn.apiKey}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toEqual(
        expect.objectContaining({ page: 1, limit: 20, total: expect.any(Number) }),
      );
    });

    it('aplica filtro por status', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders?status=RECEIVED')
        .set('Authorization', `Bearer ${userEn.apiKey}`);

      expect(res.status).toBe(200);
      for (const order of res.body.data) {
        expect(order.status).toBe('RECEIVED');
      }
    });

    it('rejeita status inválido com 400', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders?status=INVALID')
        .set('Authorization', `Bearer ${userEn.apiKey}`);
      expect(res.status).toBe(400);
    });

    it('respeita page e limit', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders?page=1&limit=5')
        .set('Authorization', `Bearer ${userEn.apiKey}`);
      expect(res.status).toBe(200);
      expect(res.body.meta.limit).toBe(5);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
    });

    it('GET /orders/:id existente → 200 com pedido completo', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orders/${createdId}`)
        .set('Authorization', `Bearer ${userEn.apiKey}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(createdId);
    });

    it('GET /orders/:id inexistente → 404', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${userEn.apiKey}`);
      expect(res.status).toBe(404);
    });
  });

  describe('i18n via preferredLanguage do usuário autenticado', () => {
    it.each([
      [() => userPt, /não encontrado/i],
      [() => userEn, /not found/i],
      [() => userEs, /no encontrado/i],
    ])(
      '404 retorna mensagem no idioma do usuário',
      async (getUser, regex) => {
        const u = getUser();
        const res = await request(app.getHttpServer())
          .get('/orders/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${u.apiKey}`);
        expect(res.status).toBe(404);
        expect(res.body.message).toMatch(regex);
      },
    );

    it('preferredLanguage do user vence Accept-Language', async () => {
      // user pt-BR + Accept-Language: en → resposta em pt-BR
      const res = await request(app.getHttpServer())
        .get('/orders/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${userPt.apiKey}`)
        .set('Accept-Language', 'en');
      expect(res.body.message).toMatch(/não encontrado/i);
    });
  });

  describe('GET /queue/metrics', () => {
    it('autenticado → devolve métricas das duas filas', async () => {
      const res = await request(app.getHttpServer())
        .get('/queue/metrics')
        .set('Authorization', `Bearer ${userEn.apiKey}`);
      expect(res.status).toBe(200);
      expect(res.body.queues).toHaveLength(2);
      const names = res.body.queues.map((q: { name: string }) => q.name).sort();
      expect(names).toEqual(['enrichment-dlq', 'enrichment-queue']);
      for (const q of res.body.queues) {
        expect(q.counts).toEqual(
          expect.objectContaining({
            waiting: expect.any(Number),
            active: expect.any(Number),
            completed: expect.any(Number),
            failed: expect.any(Number),
            delayed: expect.any(Number),
          }),
        );
      }
    });

    it('sem auth → 401', async () => {
      const res = await request(app.getHttpServer()).get('/queue/metrics');
      expect(res.status).toBe(401);
    });
  });
});
