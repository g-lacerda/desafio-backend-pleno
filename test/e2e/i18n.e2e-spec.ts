import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { loadTestcontainersEnv } from '../helpers/load-testcontainers';

describe('i18n on errors (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    loadTestcontainersEnv();

    const { AppModule } = await import('@/app.module');
    const { setupApp } = await import('@/app.setup');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it.each([
    ['en', 'Resource not found'],
    ['pt-BR', 'Recurso não encontrado'],
    ['es', 'Recurso no encontrado'],
  ])('GET /rota-inexistente com Accept-Language=%s → 404 traduzido', async (lang, expected) => {
    const res = await request(app.getHttpServer())
      .get('/rota-inexistente')
      .set('Accept-Language', lang);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe(expected);
    expect(res.body.statusCode).toBe(404);
    expect(res.body.path).toBe('/rota-inexistente');
  });
});
