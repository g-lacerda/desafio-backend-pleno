import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { OrderStatus, PrismaClient } from '@prisma/client';
import nock from 'nock';
import request from 'supertest';
import { AWESOMEAPI_HOST, bootstrapTestApp } from '../helpers/test-app';
import { poll } from '../helpers/poll';

const buildPayload = (currency = 'USD') => ({
  order_id: `ext-${randomUUID().slice(0, 8)}`,
  customer: { email: 'user@example.com', name: 'Ana' },
  items: [{ sku: 'X', qty: 2, unit_price: 59.9 }],
  currency,
  idempotency_key: randomUUID(),
});

const submitOrder = async (
  app: INestApplication,
  payload = buildPayload(),
): Promise<{ id: string }> => {
  const res = await request(app.getHttpServer()).post('/webhooks/orders').send(payload);
  expect(res.status).toBe(202);
  return { id: res.body.id };
};

describe('Enrichment worker (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    app = await bootstrapTestApp({ noMockAwesomeApi: true });
    const { PrismaService } = await import('@/shared/database/prisma.service');
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    nock.cleanAll();
    await app?.close();
  });

  beforeEach(() => {
    nock.cleanAll();
  });

  it('fluxo feliz: webhook → fila → ENRICHED com total convertido correto', async () => {
    nock(AWESOMEAPI_HOST)
      .get('/json/last/USD-BRL')
      .reply(200, { USDBRL: { bid: '5.123456' } });

    const { id } = await submitOrder(app);

    const enriched = await poll(async () => {
      const order = await prisma.order.findUnique({ where: { id } });
      return order?.status === OrderStatus.ENRICHED ? order : null;
    });

    expect(enriched.totalOriginalCents).toBe(11980);
    // 11980 × 5_123_456 = 61_379_002_880 / 1M = 61379 cents
    expect(enriched.totalConvertedCents).toBe(61379);
    expect(enriched.conversionRateMicros).toBe(5_123_456);
  });

  it('retry: 503 nas 2 primeiras tentativas, 200 na 3ª → ENRICHED', async () => {
    nock(AWESOMEAPI_HOST)
      .get('/json/last/USD-BRL')
      .reply(503)
      .get('/json/last/USD-BRL')
      .reply(503)
      .get('/json/last/USD-BRL')
      .reply(200, { USDBRL: { bid: '5.0' } });

    const { id } = await submitOrder(app);

    const enriched = await poll(
      async () => {
        const order = await prisma.order.findUnique({ where: { id } });
        return order?.status === OrderStatus.ENRICHED ? order : null;
      },
      { timeoutMs: 10_000 },
    );

    expect(enriched.totalConvertedCents).toBe(59900); // 11980 × 5 = 59900
  });

  it('falha total: 503 em todas as tentativas → FAILED_ENRICHMENT + job na DLQ', async () => {
    nock(AWESOMEAPI_HOST).persist().get('/json/last/USD-BRL').reply(503);

    const { id } = await submitOrder(app);

    const failed = await poll(
      async () => {
        const order = await prisma.order.findUnique({ where: { id } });
        return order?.status === OrderStatus.FAILED_ENRICHMENT ? order : null;
      },
      { timeoutMs: 10_000 },
    );

    expect(failed.failureReason).toBe('errors.enrichment.failed');
    expect(failed.totalConvertedCents).toBeNull();
  });

  it('4xx (moeda válida ISO mas não suportada pelo provedor) → falha imediata sem retry', async () => {
    nock(AWESOMEAPI_HOST).persist().get('/json/last/AFN-BRL').reply(404, { message: 'not found' });

    const { id } = await submitOrder(app, buildPayload('AFN'));

    const failed = await poll(
      async () => {
        const order = await prisma.order.findUnique({ where: { id } });
        return order?.status === OrderStatus.FAILED_ENRICHMENT ? order : null;
      },
      { timeoutMs: 5_000 },
    );

    expect(failed.failureReason).toBe('errors.enrichment.failed');
  });
});
