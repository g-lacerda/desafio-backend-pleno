import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapTestApp } from '../helpers/test-app';

describe('i18n on errors (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await bootstrapTestApp();
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
