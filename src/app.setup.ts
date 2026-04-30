import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { I18nService, I18nValidationExceptionFilter, I18nValidationPipe } from 'nestjs-i18n';

const BEARER_PREFIX = /^Bearer\s+/i;

/**
 * Configurações de pipes/filters globais aplicadas ANTES de app.init().
 *
 * Nota sobre rotas inexistentes: o `NotFoundController` (registrado por último em
 * `AppModule.controllers`) captura qualquer rota não mapeada e dispara
 * `NotFoundException`, que então passa pelo `HttpExceptionFilter` e é traduzida
 * via i18n. Essa é a alternativa ao middleware Express catch-all (que não funciona
 * de forma confiável porque o Express responde "Cannot GET" antes da cadeia
 * customizada).
 */
export function setupApp(app: INestApplication): void {
  app.enableCors();
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new I18nValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new I18nValidationExceptionFilter({ detailedErrors: false }));

  // Bull Board (`/admin/queues`) é montado via Express adapter (não passa pelo
  // pipeline de controllers do NestJS). Adicionamos middleware Express explícito
  // que valida `ADMIN_API_KEY` antes de qualquer route handler do Bull Board.
  // Precisa ser registrado ANTES de `app.init()` pra ficar primeiro na cadeia.
  //
  // Aceita 4 formas de autenticar:
  //   1. Header `X-Admin-Key: <key>` (uso programático)
  //   2. Header `Authorization: Bearer <key>` (uso programático)
  //   3. Query param `?admin_key=<key>` (acesso via navegador, 1ª visita)
  //   4. Cookie `admin_key` (setado automaticamente após (3) — permite que os
  //      AJAX internos do Bull Board funcionem nas requisições subsequentes)
  const adminKey = app.get(ConfigService).getOrThrow<string>('ADMIN_API_KEY');
  const i18n = app.get(I18nService);
  const fallbackLang = process.env.DEFAULT_LANGUAGE ?? 'en';
  const expressInstance = app.getHttpAdapter().getInstance() as {
    use: (path: string, handler: unknown) => unknown;
  };
  expressInstance.use(
    '/admin/queues',
    (
      req: ExpressRequestLike,
      res: ExpressResponseLike,
      next: () => void,
    ) => {
      const provided = extractAdminKey(req);
      if (!provided || provided !== adminKey) {
        // Resolve a lang manualmente — middleware Express não passa pelo
        // pipeline Nest, então `I18nContext.current()` não existe aqui.
        const lang = pickLang(req.headers['accept-language'], fallbackLang);
        // Type-cast: nestjs-i18n exige tipos gerados via CLI pra resolver `Path<K>`,
        // que aqui é `never`. Como a chave existe nos 3 errors.json, contornamos.
        const message = (
          i18n as unknown as { translate(k: string, o?: { lang?: string }): string }
        ).translate('errors.auth.missingAdminKeyBullBoard', { lang });
        res.status(401).json({
          statusCode: 401,
          message: typeof message === 'string' ? message : 'Admin key required',
          error: 'Unauthorized',
        });
        return;
      }
      // Se a chave veio por query param (navegação direta), seta cookie pra que
      // os AJAX internos do Bull Board passem pela mesma autenticação.
      const cameFromQuery = typeof req.query?.admin_key === 'string';
      const noCookieYet = parseCookie(req.headers.cookie, 'admin_key') !== adminKey;
      if (cameFromQuery && noCookieYet) {
        res.setHeader(
          'Set-Cookie',
          `admin_key=${encodeURIComponent(adminKey)}; Path=/admin/queues; HttpOnly; SameSite=Strict; Max-Age=3600`,
        );
      }
      next();
    },
  );
}

interface ExpressRequestLike {
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
}

interface ExpressResponseLike {
  status: (n: number) => { json: (body: unknown) => unknown };
  setHeader: (name: string, value: string) => void;
}

function extractAdminKey(req: ExpressRequestLike): string | null {
  const headerKey = req.headers['x-admin-key'];
  if (typeof headerKey === 'string' && headerKey.length > 0) return headerKey;
  const authorization = req.headers.authorization;
  if (typeof authorization === 'string' && BEARER_PREFIX.test(authorization)) {
    return authorization.replace(BEARER_PREFIX, '').trim() || null;
  }
  const queryKey = req.query?.admin_key;
  if (typeof queryKey === 'string' && queryKey.length > 0) return queryKey;
  const cookieKey = parseCookie(req.headers.cookie, 'admin_key');
  if (cookieKey) return cookieKey;
  return null;
}

function parseCookie(
  header: string | string[] | undefined,
  name: string,
): string | null {
  if (typeof header !== 'string') return null;
  for (const part of header.split(';')) {
    const [k, v] = part.trim().split('=');
    if (k === name && v !== undefined) return decodeURIComponent(v);
  }
  return null;
}

const SUPPORTED_LANGS = ['pt-BR', 'en', 'es'];

/**
 * Parser mínimo de Accept-Language pro middleware do Bull Board (que roda
 * fora do pipeline Nest). Pega o primeiro idioma suportado em ordem de q,
 * caso contrário usa o fallback. Suporta tanto `pt-BR` quanto `pt`.
 */
function pickLang(header: string | string[] | undefined, fallback: string): string {
  if (typeof header !== 'string' || header.length === 0) return fallback;
  const candidates = header
    .split(',')
    .map((part) => part.split(';')[0].trim())
    .filter(Boolean);
  for (const cand of candidates) {
    const exact = SUPPORTED_LANGS.find((l) => l.toLowerCase() === cand.toLowerCase());
    if (exact) return exact;
    const prefix = cand.split('-')[0].toLowerCase();
    const prefixMatch = SUPPORTED_LANGS.find(
      (l) => l.split('-')[0].toLowerCase() === prefix,
    );
    if (prefixMatch) return prefixMatch;
  }
  return fallback;
}

/**
 * Configura o Swagger UI em `/docs` e o spec OpenAPI em `/docs-json`.
 * Chamado tanto no `main.ts` quanto nos testes E2E para garantir paridade.
 */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Order Orchestrator')
    .setDescription(
      'Webhook-driven order orchestrator with idempotency, async enrichment and DLQ.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'X-API-Key')
    .addApiKey({ type: 'apiKey', name: 'X-Admin-Key', in: 'header' }, 'X-Admin-Key')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
}
