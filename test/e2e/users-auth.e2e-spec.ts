import { INestApplication } from '@nestjs/common';
import { Language, PrismaClient } from '@prisma/client';
import request from 'supertest';
import { ADMIN_KEY, bootstrapTestApp } from '../helpers/test-app';

const buildUserPayload = (
  overrides: Partial<{
    email: string;
    name: string;
    password: string;
    preferredLanguage: Language;
  }> = {},
) => ({
  email:
    overrides.email ??
    `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@inbazz.com`,
  name: overrides.name ?? 'Demo User',
  password: overrides.password ?? 'demo-pass-1234',
  preferredLanguage: overrides.preferredLanguage ?? Language.PT_BR,
});

describe('Users + Auth (E2E)', () => {
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

  describe('POST /users (admin-only)', () => {
    it('sem admin key → 401', async () => {
      const res = await request(app.getHttpServer()).post('/users').send(buildUserPayload());
      expect(res.status).toBe(401);
    });

    it('com admin key inválida → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .set('X-Admin-Key', 'wrong-admin-key')
        .send(buildUserPayload());
      expect(res.status).toBe(401);
    });

    it('com admin key válida → 201 com API key uma única vez', async () => {
      const payload = buildUserPayload();
      const res = await request(app.getHttpServer())
        .post('/users')
        .set('X-Admin-Key', ADMIN_KEY)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.id).toEqual(expect.any(String));
      expect(res.body.email).toBe(payload.email);
      expect(res.body.api_key).toMatch(/^sk_live_[A-Za-z0-9_-]+$/);
      expect(res.body).not.toHaveProperty('apiKeyHash');
      expect(res.body).not.toHaveProperty('api_key_hash');

      const persisted = await prisma.user.findUnique({ where: { email: payload.email } });
      expect(persisted).not.toBeNull();
      expect(persisted?.apiKeyHash).toEqual(expect.any(String));
    });

    it('aceita admin key via Authorization: Bearer também', async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${ADMIN_KEY}`)
        .send(buildUserPayload());
      expect(res.status).toBe(201);
    });

    it('rejeita email duplicado com 409 traduzido', async () => {
      const payload = buildUserPayload();
      await request(app.getHttpServer())
        .post('/users')
        .set('X-Admin-Key', ADMIN_KEY)
        .send(payload);

      const res = await request(app.getHttpServer())
        .post('/users')
        .set('X-Admin-Key', ADMIN_KEY)
        .set('Accept-Language', 'pt-BR')
        .send(payload);

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/já existe/i);
    });

    it('rejeita preferredLanguage inválido (com admin key)', async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .set('X-Admin-Key', ADMIN_KEY)
        .send({ ...buildUserPayload(), preferredLanguage: 'fr' });
      expect(res.status).toBe(400);
    });
  });

  describe('Bull Board (admin-only)', () => {
    it('sem admin key → 401', async () => {
      const res = await request(app.getHttpServer()).get('/admin/queues');
      expect(res.status).toBe(401);
    });

    it('com X-Admin-Key → 200/302', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/queues')
        .set('X-Admin-Key', ADMIN_KEY);
      expect([200, 301, 302]).toContain(res.status);
    });

    it('com Authorization: Bearer → 200/302', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/queues')
        .set('Authorization', `Bearer ${ADMIN_KEY}`);
      expect([200, 301, 302]).toContain(res.status);
    });

    it('com query param ?admin_key=... → 200/302 + cookie setado', async () => {
      const res = await request(app.getHttpServer()).get(
        `/admin/queues?admin_key=${encodeURIComponent(ADMIN_KEY)}`,
      );
      expect([200, 301, 302]).toContain(res.status);
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      expect(String(setCookie)).toContain('admin_key=');
      expect(String(setCookie)).toContain('HttpOnly');
    });

    it('com cookie admin_key → 200/302 (sem query nem header)', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/queues')
        .set('Cookie', `admin_key=${ADMIN_KEY}`);
      expect([200, 301, 302]).toContain(res.status);
    });
  });

  describe('Endpoints autenticados', () => {
    let apiKey: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .set('X-Admin-Key', ADMIN_KEY)
        .send(buildUserPayload());
      apiKey = res.body.api_key;
    });

    it('GET /orders sem header → 401 com mensagem traduzida', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders')
        .set('Accept-Language', 'pt-BR');
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/chave de api obrigatória/i);
    });

    it('GET /orders com chave inválida → 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', 'Bearer sk_live_invalid');
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/invalid/i);
    });

    it('GET /orders com Bearer válido → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${apiKey}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
    });

    it('GET /orders com X-API-Key válido → 200', async () => {
      const res = await request(app.getHttpServer()).get('/orders').set('X-API-Key', apiKey);
      expect(res.status).toBe(200);
    });
  });

  describe('Endpoints públicos', () => {
    it.each(['/health', '/metrics', '/docs', '/docs-json'])(
      '%s não exige auth',
      async (path) => {
        const res = await request(app.getHttpServer()).get(path);
        expect([200, 301]).toContain(res.status);
      },
    );
  });

  describe('POST /auth/login (rotação de API key)', () => {
    let originalKey: string;
    let userEmail: string;
    const password = 'rotation-pass-1234';

    beforeAll(async () => {
      const payload = buildUserPayload({ password });
      userEmail = payload.email;
      const res = await request(app.getHttpServer())
        .post('/users')
        .set('X-Admin-Key', ADMIN_KEY)
        .send(payload);
      originalKey = res.body.api_key;
    });

    it('credenciais válidas → 200 com nova API key (rotação)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: userEmail, password });

      expect(res.status).toBe(200);
      expect(res.body.api_key).toMatch(/^sk_live_[A-Za-z0-9_-]+$/);
      expect(res.body.api_key).not.toBe(originalKey);
      expect(res.body.email).toBe(userEmail);

      // a chave nova funciona em endpoints autenticados
      const checkNew = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${res.body.api_key}`);
      expect(checkNew.status).toBe(200);

      // a chave antiga foi invalidada
      const checkOld = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${originalKey}`);
      expect(checkOld.status).toBe(401);
    });

    it('senha errada → 401 com mensagem genérica traduzida', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Accept-Language', 'pt-BR')
        .send({ email: userEmail, password: 'wrong-password-xx' });

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/email ou senha inválidos/i);
    });

    it('email inexistente → 401 (não vaza enumeração)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nope@inbazz.com', password: 'whatever-strong' });

      expect(res.status).toBe(401);
    });

    it('payload inválido → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'not-email', password: '' });
      expect(res.status).toBe(400);
    });
  });
});
