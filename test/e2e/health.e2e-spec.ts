import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapTestApp } from '../helpers/test-app';

describe('Health (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await bootstrapTestApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /health → 200 com database e redis up', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.info.database.status).toBe('up');
    expect(res.body.info.redis.status).toBe('up');
  });

  it('boot do app não emite erros (smoke test)', () => {
    expect(app).toBeDefined();
    expect(app.getHttpServer()).toBeDefined();
  });
});
