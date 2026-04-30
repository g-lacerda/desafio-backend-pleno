# Variáveis de ambiente

> Voltar pro [README](../README.md).

Todas validadas via Joi schema em [`src/shared/config/env.validation.ts`](../src/shared/config/env.validation.ts). Ver [`.env.example`](../.env.example) para a lista completa com defaults.

| Categoria | Vars |
|---|---|
| App | `NODE_ENV`, `PORT`, `UI_PORT` |
| Postgres | `DATABASE_URL`, `POSTGRES_USER/PASSWORD/DB/PORT` |
| Redis | `REDIS_HOST`, `REDIS_PORT` |
| i18n | `DEFAULT_LANGUAGE` (`en` \| `pt-BR` \| `es`) |
| Throttler | `WEBHOOK_THROTTLE_TTL_SECONDS`, `WEBHOOK_THROTTLE_LIMIT` |
| Idempotência | `IDEMPOTENCY_TTL_HOURS` |
| AwesomeAPI | `AWESOMEAPI_BASE_URL`, `AWESOMEAPI_TIMEOUT_MS`, `AWESOMEAPI_TOKEN` (opcional) |
| Worker | `ENRICHMENT_MAX_ATTEMPTS`, `ENRICHMENT_BACKOFF_BASE_MS` |
| Auth admin | `ADMIN_API_KEY` (mín 16 chars, obrigatória) |
| Webhook | `WEBHOOK_SECRET` (mín 16 chars, obrigatória) |

Em produção, gere os secrets com `openssl rand -base64 32`.
