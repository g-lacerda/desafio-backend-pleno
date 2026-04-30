# Arquitetura

Este documento descreve a organização interna, o fluxo de processamento de um pedido e a estrutura de pastas do projeto.

> Voltar pro [README](../README.md).

## Visão modular

Cada módulo segue o padrão `controller → service → repository → mapper → entity`, com anti-corruption layer entre DTOs (decimal/snake_case) e domínio (cents/camelCase). Sem CQRS / Event Sourcing / Hexagonal completa — over-engineering pro escopo.

## Fluxo de um pedido

```
Cliente externo (POST /webhooks/orders)
     │
     ▼
WebhookController
   ├─ WebhookSecretGuard       (X-Webhook-Secret)
   ├─ ThrottlerGuard           (limite por IP)
   ├─ ValidationPipe (DTO)
   └─ IdempotencyInterceptor
         ├─ INSERT idempotency_keys (IN_PROGRESS)
         ├─ Conflito + mesmo hash + COMPLETED  → replay byte-a-byte
         ├─ Conflito + hash divergente         → 422
         ├─ Conflito + IN_PROGRESS             → 409
         └─ Caso contrário ↓
              OrdersService.receive()
                ├─ Persiste Order (RECEIVED, totals em cents)
                └─ Enfileira job no BullMQ (enrichment-queue)
              ◄ retorna 202 Accepted

EnrichmentProcessor (worker BullMQ)
   ├─ status: ENRICHING
   ├─ ExchangeRateClient.getRateToBrlMicros(currency)
   ├─ totalConvertedCents = convertCents(originalCents, rateMicros)   (BigInt)
   ├─ status: ENRICHED
   └─ Em caso de falha:
        ├─ 5xx / timeout         → retry exponencial (até N tentativas)
        ├─ 4xx / moeda inválida  → UnrecoverableError (sem retry)
        └─ Esgotou tentativas    → status FAILED_ENRICHMENT + job na DLQ
```

## Estrutura de pastas

```
src/
├── main.ts                          Bootstrap (NestFactory + setupApp)
├── app.module.ts                    Composição raiz dos módulos
├── app.setup.ts                     setupApp() e setupSwagger() reutilizáveis
├── modules/
│   ├── admin/                       Bull Board mount
│   ├── auth/                        POST /auth/login (rotaciona API key)
│   ├── enrichment/                  Worker, AwesomeAPI client, exceptions
│   ├── health/                      Terminus + Prisma/Redis indicators
│   ├── orders/                      Webhook + GETs + DTOs + mapper + repository
│   ├── queue/                       Métricas agregadas das filas
│   └── users/                       POST /users + auth lookup
└── shared/
    ├── auth/                        ApiKeyGuard + AdminKeyGuard + WebhookSecretGuard
    ├── config/                      env.validation (Joi)
    ├── database/                    PrismaModule + PrismaService
    ├── filters/                     HttpExceptionFilter (i18n-aware)
    ├── i18n/                        UserLanguageResolver + language.utils
    ├── idempotency/                 Service + Interceptor + exceptions
    ├── logger/                      Pino config
    ├── metrics/                     Prometheus counters
    ├── money/                       toCents/fromCents/convertCents (BigInt)
    ├── not-found/                   Catch-all 404 controller
    └── queue/                       Constants (queue names)

i18n/
├── en/{validation,errors,messages}.json
├── pt-BR/{validation,errors,messages}.json
└── es/{validation,errors,messages}.json

prisma/
└── schema.prisma                    User, Order, IdempotencyKey

scripts/
├── seed-users.ts                    Cria 3 usuários demo
├── seed-webhook.ts                  Dispara cenários de webhook
└── export-openapi.ts                Gera collections/openapi.json

collections/
├── postman_collection.json          Coleção Postman curada (cenários nomeados)
└── openapi.json                     Spec OpenAPI 3.0 (importável em Insomnia/Bruno)

test/
├── e2e/                             Testes end-to-end com Testcontainers
└── helpers/                         Bootstrap de app, poll de jobs
```
