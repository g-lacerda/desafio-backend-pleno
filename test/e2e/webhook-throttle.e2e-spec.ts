import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { bootstrapTestApp, postWebhook } from '../helpers/test-app';

const buildPayload = () => ({
  order_id: `ext-${randomUUID().slice(0, 8)}`,
  customer: { email: 'a@b.com', name: 'Ana' },
  items: [{ sku: 'X', qty: 1, unit_price: 10 }],
  currency: 'USD',
  idempotency_key: randomUUID(),
});

describe('Webhook throttler (E2E)', () => {
  let app: INestApplication;
  const LIMIT = 3;

  beforeAll(async () => {
    app = await bootstrapTestApp({
      envOverrides: {
        WEBHOOK_THROTTLE_LIMIT: String(LIMIT),
        WEBHOOK_THROTTLE_TTL_SECONDS: '60',
      },
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it(`bloqueia a ${LIMIT + 1}ª requisição com 429 dentro da janela`, async () => {
    for (let i = 0; i < LIMIT; i++) {
      const res = await postWebhook(app).send(buildPayload());
      expect([202, 422]).toContain(res.status);
    }

    const overflow = await postWebhook(app).send(buildPayload());

    expect(overflow.status).toBe(429);
  });

  it('mensagem 429 vem traduzida via Accept-Language', async () => {
    const res = await postWebhook(app)
      .set('Accept-Language', 'pt-BR')
      .send(buildPayload());

    expect(res.status).toBe(429);
    expect(res.body.message).toMatch(/aguarde|momento/i);
  });
});
