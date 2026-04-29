import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import nock from 'nock';
import request from 'supertest';
import { loadTestcontainersEnv } from './load-testcontainers';

const AWESOMEAPI_TEST_HOST = 'http://localhost:39101';
const TEST_ADMIN_KEY = 'test-admin-key-for-e2e-only-1234567890';
const TEST_WEBHOOK_SECRET = 'test-webhook-secret-for-e2e-only-1234567890';

interface BootstrapOptions {
  envOverrides?: Record<string, string>;
  /** Disable the default nock mock (when test wants to control AwesomeAPI explicitly). */
  noMockAwesomeApi?: boolean;
}

/**
 * Bootstrap padrão para testes E2E:
 *
 * 1. Carrega env do Testcontainers (Postgres/Redis efêmeros).
 * 2. Limpa o Redis para evitar jobs vazados de testes anteriores.
 * 3. Aponta a AwesomeAPI para um host local interceptado via `nock` e configura
 *    backoff curto pra que retries não atrasem os testes.
 * 4. Mocka a AwesomeAPI com resposta de sucesso padrão (a menos que o teste peça
 *    pra controlar manualmente).
 * 5. Sobe o AppModule já configurado.
 */
export async function bootstrapTestApp(options: BootstrapOptions = {}): Promise<INestApplication> {
  loadTestcontainersEnv();

  process.env.AWESOMEAPI_BASE_URL = AWESOMEAPI_TEST_HOST;
  process.env.AWESOMEAPI_TIMEOUT_MS = '2000';
  process.env.ENRICHMENT_MAX_ATTEMPTS = process.env.ENRICHMENT_MAX_ATTEMPTS ?? '3';
  process.env.ENRICHMENT_BACKOFF_BASE_MS = process.env.ENRICHMENT_BACKOFF_BASE_MS ?? '50';
  process.env.WEBHOOK_THROTTLE_LIMIT = process.env.WEBHOOK_THROTTLE_LIMIT ?? '1000';
  process.env.ADMIN_API_KEY = TEST_ADMIN_KEY;
  process.env.WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
  // Cada bootstrap gera um prefix único — isola filas entre test files E2E rodando
  // contra o mesmo Redis. Workers vazados de outros test files não veem os jobs.
  process.env.BULL_PREFIX = `bull-test-${randomUUID().slice(0, 8)}`;

  Object.entries(options.envOverrides ?? {}).forEach(([key, value]) => {
    process.env[key] = value;
  });

  await flushRedis();

  if (!options.noMockAwesomeApi) {
    nock(AWESOMEAPI_TEST_HOST)
      .persist()
      .get(/\/json\/last\/.+/)
      .reply(200, { USDBRL: { bid: '5.0' } });
  }

  const { AppModule } = await import('@/app.module');
  const { setupApp, setupSwagger } = await import('@/app.setup');

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ bufferLogs: true });
  setupApp(app);
  setupSwagger(app);
  await app.init();
  return app;
}

export const AWESOMEAPI_HOST = AWESOMEAPI_TEST_HOST;
export const ADMIN_KEY = TEST_ADMIN_KEY;
export const WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;

/**
 * Helper supertest pra POST /webhooks/orders já com o header `X-Webhook-Secret`
 * setado. Mantém os testes DRY ao mesmo tempo que reflete a auth real.
 */
export const postWebhook = (app: INestApplication) =>
  request(app.getHttpServer())
    .post('/webhooks/orders')
    .set('X-Webhook-Secret', TEST_WEBHOOK_SECRET);

async function flushRedis(): Promise<void> {
  const redis = new Redis({
    host: process.env.REDIS_HOST!,
    port: Number(process.env.REDIS_PORT),
    lazyConnect: false,
    maxRetriesPerRequest: 1,
  });
  try {
    await redis.flushall();
  } finally {
    await redis.quit();
  }
}
