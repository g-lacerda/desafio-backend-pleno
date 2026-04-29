# Orquestrador de Pedidos

API em NestJS para recebimento, validação e enriquecimento assíncrono de pedidos vindos de fontes externas (e-commerce, marketplaces, gateways de pagamento). Implementação do desafio backend pleno da [Inbazz](https://inbazz.com).

> Especificação original do desafio em [DESAFIO.md](DESAFIO.md).

---

## Sobre o projeto

O serviço é um ponto de entrada confiável para pedidos externos. Resolve quatro problemas clássicos de integração:

1. **Acoplamento temporal**, webhook responde rápido (`202 Accepted`); processamento ocorre em background.
2. **Idempotência**, o mesmo `idempotency_key` recebido N vezes tem efeito de uma única vez (replay byte-a-byte da resposta).
3. **Falhas em cascata**, se a API externa de enriquecimento falha, retry com backoff exponencial e Dead Letter Queue após esgotamento.
4. **Observabilidade operacional**, status persistido em banco, métricas Prometheus, UI de inspeção de filas, health check.

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | NestJS 11 |
| Linguagem | TypeScript 5 |
| Banco | PostgreSQL 16 (via Prisma 6) |
| Fila | BullMQ 5 + Redis 7 (`@nestjs/bullmq`) |
| HTTP client | `@nestjs/axios` (consumo da AwesomeAPI para câmbio) |
| Validação | `class-validator` + `class-transformer` |
| Documentação | Swagger (`@nestjs/swagger`) em `/docs` |
| Logs | Pino estruturado (`nestjs-pino`) |
| i18n | `nestjs-i18n` (pt-BR, en, es) |
| Auth | API key per user (`Authorization: Bearer …` ou `X-API-Key`, hash SHA-256) |
| Health check | `@nestjs/terminus` em `/health` |
| Rate limiting | `@nestjs/throttler` |
| Métricas | Prometheus (`@willsoto/nestjs-prometheus`) em `/metrics` |
| Inspeção de fila | Bull Board em `/admin/queues` |
| Testes | Jest + Supertest + Testcontainers + nock |
| Disciplina | Conventional Commits + commitlint + husky |
| Infra local | Docker Compose (Postgres + Redis) |

## Roadmap

- [x] **Fase 1**, Fundação e infraestrutura.
- [x] **Fase 2**, Recebimento do pedido (webhook, idempotência, throttler).
- [x] **Fase 3**, Processamento assíncrono (worker, retry, DLQ, AwesomeAPI).
- [x] **Fase 4**, Usuários, autenticação, consulta e administração.
- [x] **Fase 5**, Polimento, scripts de seed, coleções Postman, README final.

---

## Como executar

### Pré-requisitos

| Ferramenta | Versão | Como instalar |
|---|---|---|
| **Node.js** | 20+ | Linux/macOS: [nvm](https://github.com/nvm-sh/nvm) (`curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh \| bash` e depois `nvm install 20`), Windows: [nodejs.org](https://nodejs.org/) (LTS) ou [nvm-windows](https://github.com/coreybutler/nvm-windows) |
| **Docker** + **Docker Compose** | recente | Linux: [docs.docker.com/engine/install](https://docs.docker.com/engine/install/) (Engine + plugin Compose), macOS/Windows: [Docker Desktop](https://www.docker.com/products/docker-desktop/) |
| **Git** | qualquer | Linux: `sudo apt install git` / `sudo dnf install git`, macOS: `brew install git` (ou Xcode CLT), Windows: [git-scm.com](https://git-scm.com/download/win) |

<details>
<summary>📋 Comandos copy-paste por sistema</summary>

**Ubuntu / Debian:**
```bash
# Git + Docker (Engine)
sudo apt update && sudo apt install -y git ca-certificates curl
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# Node 20 via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
\. "$HOME/.nvm/nvm.sh" && nvm install 20
```

**macOS (com [Homebrew](https://brew.sh)):**
```bash
brew install git
brew install --cask docker        # Docker Desktop
brew install nvm && nvm install 20
```

**Windows (com [Chocolatey](https://chocolatey.org/install) ou [Scoop](https://scoop.sh)):**
```powershell
# Chocolatey
choco install -y git nodejs-lts docker-desktop

# Ou Scoop
scoop install git nodejs-lts
# Docker Desktop: baixar do site oficial
```

</details>

Verifique tudo de uma vez:
```bash
node -v && docker -v && docker compose version && git --version
```

Escolha **uma** das duas opções abaixo. Use a **Opção A (Docker)** se quer apenas avaliar/testar, ela é mais simples e não exige Node instalado. Use a **Opção B (Local)** apenas se for modificar o código com hot reload.

---

### Opção A, Docker (recomendado para avaliação)

> ✅ Não precisa instalar Node, npm, Prisma CLI nem rodar migrations manualmente. O `docker compose up` sobe Postgres + Redis + Backend + UI; o container do backend roda `prisma migrate deploy` automaticamente no startup.

**1. Clone e configure:**
```bash
git clone https://github.com/g-lacerda/desafio-backend-pleno.git
cd desafio-backend-pleno
cp .env.example .env
```

**2. Suba tudo:**
```bash
docker compose up -d --build
```

**3. Provisione 3 usuários demo (gera as API keys):**
```bash
docker compose exec app npm run seed:users
```

Imprime as 3 API keys (`demo-pt@inbazz.com`, `demo-en@inbazz.com`, `demo-es@inbazz.com`). Senha de todos: `demo-pass-1234`. Cole as chaves nas variáveis `apiKeyPtBR`/`EN`/`ES` do Postman ou no campo "API Key" da UI.

**4. (Opcional) Dispare cenários de demonstração:**
```bash
docker compose exec app npm run seed:webhook                          # 1 pedido válido
docker compose exec app npm run seed:webhook -- --scenario=duplicate  # replay (mesma chave 2x)
docker compose exec app npm run seed:webhook -- --scenario=hash       # hash divergente (422)
docker compose exec app npm run seed:webhook -- --scenario=invalid    # payload inválido (400)
docker compose exec app npm run seed:webhook:load                     # 50 pedidos paralelos
docker compose exec app npm run seed:webhook:dlq                      # moeda AFN → vai pra DLQ
docker compose exec app npm run seed:webhook:all                      # roda todos os cenários
```

**Acesse:**

| Serviço | URL |
|---|---|
| UI Console | http://localhost:8080 |
| API | http://localhost:3000 |
| Swagger | http://localhost:3000/docs |
| Bull Board | http://localhost:3000/admin/queues?admin_key=change-me-to-a-strong-random-secret |
| Health | http://localhost:3000/health |
| Métricas Prometheus | http://localhost:3000/metrics |

**Para parar tudo:**
```bash
docker compose down
```

---

### Opção B, Local (para desenvolvimento com hot reload)

Use esta opção apenas se for modificar o código e quiser `nest start --watch`. Requer Node 20+ instalado.

**1. Clone, configure e instale dependências:**
```bash
git clone https://github.com/g-lacerda/desafio-backend-pleno.git
cd desafio-backend-pleno
cp .env.example .env
npm install
```

**2. Suba só a infra (Postgres + Redis):**
```bash
docker compose up -d postgres redis
```

**3. Aplique as migrations:**
```bash
npm run prisma:migrate
```

**4. Suba o backend em watch mode:**
```bash
npm run start:dev
```

**5. (Em outro terminal) Suba a UI:**
```bash
npx serve UI -l 8080
```

**6. (Em outro terminal) Provisione usuários e dispare cenários:**
```bash
npm run seed:users
npm run seed:webhook        # ou outras variações
```

**Acesse:** as mesmas URLs da Opção A (UI em :8080, API em :3000).

---

## Endpoints

| Método | Endpoint | Auth | Descrição |
|---|---|---|---|
| `POST` | `/users` | **Admin Key** (`X-Admin-Key`) | Cria usuário (com `password` bcrypt) e devolve `api_key` uma única vez. |
| `POST` | `/auth/login` | público | Autentica `email` + `password` e **rotaciona** a API key (use se perdeu a chave). |
| `POST` | `/webhooks/orders` | público (rate-limited) | Recebe pedido, valida, garante idempotência e enfileira para enrichment. |
| `GET` | `/orders` | User API key (`Authorization: Bearer` ou `X-API-Key`) | Lista pedidos com filtro `status` e paginação. |
| `GET` | `/orders/:id` | User API key | Detalhes de um pedido. |
| `GET` | `/queue/metrics` | User API key | Contadores agregados das filas (`enrichment-queue`, `enrichment-dlq`). |
| `GET` | `/admin/queues` | **Admin Key** (`X-Admin-Key`) | UI HTML do Bull Board para inspecionar/retentar/descartar jobs. |
| `GET` | `/health` | público | Health check (Postgres + Redis). |
| `GET` | `/metrics` | público | Métricas Prometheus (default + customizadas). |
| `GET` | `/docs` | público | Swagger UI. |
| `GET` | `/docs-json` | público | Spec OpenAPI 3.0 cru. |

### Dois níveis de autenticação

- **User API key** (`sk_live_...`), gerada por `POST /users`, identifica um usuário individual. Usada nos endpoints de consulta (`/orders`, `/queue/metrics`).
- **Admin key**, segredo único compartilhado, vem da env `ADMIN_API_KEY` (mín 16 chars). Usada pra operações administrativas: provisionar usuários (`POST /users`) e acessar Bull Board (`/admin/queues`). Em produção real, ficaria atrás de um secret manager (AWS Secrets, Vault, etc.).

---

## Fluxo de um pedido

```
Cliente externo (POST /webhooks/orders)
     │
     ▼
WebhookController
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

---

## Decisões técnicas

### Valores monetários como inteiros (`_cents` / `_micros`)

Toda quantia monetária é armazenada e operada como **inteiro na menor unidade** (centavos). Taxas de câmbio em micro-unidades (× 10⁶). Sem `Decimal`/`float`/`decimal.js` em runtime.

Por quê: elimina ambiguidade de ponto flutuante (`0.1 + 0.2 ≠ 0.3` em IEEE 754), serialização JSON é segura, aritmética é exata e rápida. Convenção universal (Stripe, PayPal, Square). Conversão usa `BigInt` na multiplicação intermediária para evitar overflow em valores grandes. Detalhes em `src/shared/money/money.utils.ts`.

### Idempotência via tabela dedicada (não UNIQUE constraint)

Implementação no padrão Stripe:

- Tabela `idempotency_keys` com hash SHA-256 do payload, status (`IN_PROGRESS`/`COMPLETED`/`FAILED`), `responseStatus`/`responseBody` cacheados, `expiresAt`.
- Replay devolve **byte-a-byte** a resposta original (não apenas "já existe").
- Detecção de **reuso indevido** (mesma chave + payload diferente) → 422.
- Estado `FAILED` é tratado como expirado (cliente pode retentar).

### API key per user (modelo machine-to-machine) com login para recuperação

Padrão de mercado (Stripe, OpenAI, Anthropic): cada usuário tem uma API key permanente, sem JWT/sessão/refresh.

- `crypto.randomBytes(32).toString('base64url')` → 256 bits de entropia.
- Banco guarda só `SHA-256(key)` indexado (lookup O(1) sem expor a chave).
- Plain text retornado **uma única vez** na criação do usuário.
- Sem expiração natural, a chave dura até ser rotacionada.

**Recuperação se perder a chave:** `POST /auth/login` com email + senha (bcrypt) gera **nova API key** e invalida a anterior. A senha é informada na criação do usuário e armazenada como hash bcrypt. Por design, não diferenciamos "email não existe" de "senha incorreta" no erro 401 (mensagem genérica `errors.auth.invalidCredentials` para evitar enumeração).

### i18n com cascata de resolução

Idioma da resposta resolvido na ordem:

1. `preferredLanguage` do usuário autenticado (lido do `req.user` no `HttpExceptionFilter`).
2. Header `Accept-Language` (resolver padrão do `nestjs-i18n`).
3. Default global (`DEFAULT_LANGUAGE` env, fallback `en`).

Mensagens de exceções de negócio são armazenadas como **chaves i18n** (ex.: `errors.order.notFound`); a tradução acontece apenas na borda HTTP. `Order.failureReason` persiste a chave, não a mensagem traduzida.

### Arquitetura modular

- Cada módulo segue `controller → service → repository → mapper → entity`.
- Anti-corruption layer entre DTOs (decimal/snake_case) e domínio (cents/camelCase).
- Sem CQRS / Event Sourcing / Hexagonal completa, over-engineering pro escopo.

### Worker BullMQ com retry/DLQ tipado

- Erros transientes (5xx, timeout) → retry com backoff exponencial.
- Erros permanentes (4xx, moeda inválida) → `UnrecoverableError` BullMQ → DLQ imediato.
- `@OnWorkerEvent('failed')` marca `FAILED_ENRICHMENT` quando esgota tentativas.
- DLQ é uma fila separada (`enrichment-dlq`) sem worker, apenas armazena para inspeção.

---

## Internacionalização

A API responde em 3 idiomas: **pt-BR**, **en**, **es**. A resolução é em cascata (ver "Decisões técnicas" acima).

```bash
# Sem auth: usa Accept-Language
curl -H "Accept-Language: pt-BR" http://localhost:3000/rota-inexistente
# {"message":"Recurso não encontrado", ...}

# Com auth: usa preferredLanguage do usuário
curl -H "Authorization: Bearer sk_live_..." http://localhost:3000/orders/inexistente
# (em pt-BR/en/es conforme o usuário)
```

---

## Testes

```bash
npm test                # unit tests
npm run test:cov        # cobertura (alvo: ≥ 85%)
npm run test:e2e        # E2E com Testcontainers (requer Docker rodando)
```

**Cobertura atual:** ~95% statements / ~86% branches.

**E2E:** sobe Postgres + Redis efêmeros via [Testcontainers](https://testcontainers.com/), aplica as migrations e roda os fluxos completos. Cada test file usa um `BULL_PREFIX` único pra isolar filas, pode rodar em paralelo sem conflito. AwesomeAPI mockada com [`nock`](https://github.com/nock/nock).

**Cenários cobertos:**

- Webhook: payload válido, replay, hash divergente, validação (em 3 idiomas), throttler.
- Worker: golden path, retry 503/503/200, falha total → DLQ, 4xx sem retry.
- Auth: API key inválida/ausente/válida, Bearer + X-API-Key, rotas públicas.
- Consulta: paginação, filtro por status, 404 traduzido conforme idioma do usuário.
- Métricas: shape correto das filas principal e DLQ.

---

## Documentação adicional

- `/docs`, Swagger UI interativa.
- [docs/openapi.json](docs/openapi.json), spec OpenAPI 3.0 versionado (regenere com `npm run docs:export`).
- [docs/postman_collection.json](docs/postman_collection.json), coleção Postman curada com todos os cenários e variáveis para 3 API keys (uma por idioma).
- [DESAFIO.md](DESAFIO.md), especificação original do desafio.

### Importar no Postman

1. Postman → **Import** → arrasta `docs/postman_collection.json`.
2. Rode `npm run seed:users` no terminal.
3. Cole as 3 API keys impressas nas variáveis `apiKeyPtBR`, `apiKeyEN`, `apiKeyES` da coleção.
4. Use os endpoints. As mensagens de erro virão no idioma do usuário escolhido.

### Importar OpenAPI em outras ferramentas

`docs/openapi.json` é importável em Insomnia, Hoppscotch, Bruno, ou qualquer ferramenta que entenda OpenAPI 3.0.

---

## Variáveis de ambiente

Todas validadas via Joi schema em `src/shared/config/env.validation.ts`. Ver `.env.example` para a lista completa com defaults.

| Categoria | Vars |
|---|---|
| App | `NODE_ENV`, `PORT` |
| Postgres | `DATABASE_URL`, `POSTGRES_USER/PASSWORD/DB/PORT` |
| Redis | `REDIS_HOST`, `REDIS_PORT` |
| i18n | `DEFAULT_LANGUAGE` |
| Throttler | `WEBHOOK_THROTTLE_TTL_SECONDS`, `WEBHOOK_THROTTLE_LIMIT` |
| Idempotência | `IDEMPOTENCY_TTL_HOURS` |
| AwesomeAPI | `AWESOMEAPI_BASE_URL`, `AWESOMEAPI_TIMEOUT_MS`, `AWESOMEAPI_TOKEN` (opcional) |
| Worker | `ENRICHMENT_MAX_ATTEMPTS`, `ENRICHMENT_BACKOFF_BASE_MS` |
| Auth admin | `ADMIN_API_KEY` (mín 16 chars, obrigatória) |

---

## Trade-offs assumidos

- **Validation pipes com Accept-Language em vez de user.preferredLanguage**, pipes rodam após guards mas o `I18nContext` foi setado por middleware antes do guard. Erros de validação em rotas autenticadas usam o `Accept-Language`, não a preferência do usuário. Mensagens de exceções de negócio (404, 422, etc.) usam a preferência do usuário corretamente via `HttpExceptionFilter`.

---

## Estrutura do projeto

```
src/
├── main.ts                          Bootstrap (NestFactory + setupApp)
├── app.module.ts                    Composição raiz dos módulos
├── app.setup.ts                     setupApp() e setupSwagger() reutilizáveis
├── modules/
│   ├── admin/                       Bull Board mount
│   ├── enrichment/                  Worker, AwesomeAPI client, exceptions
│   ├── health/                      Terminus + Prisma/Redis indicators
│   ├── orders/                      Webhook + GETs + DTOs + mapper + repository
│   ├── queue/                       Métricas agregadas das filas
│   └── users/                       POST /users + auth lookup
└── shared/
    ├── auth/                        ApiKeyGuard + decorators + utils
    ├── config/                      env.validation (Joi)
    ├── database/                    PrismaModule + PrismaService
    ├── filters/                     HttpExceptionFilter (i18n-aware)
    ├── i18n/                        UserLanguageResolver
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
└── export-openapi.ts                Gera docs/openapi.json

test/
├── e2e/                             Testes end-to-end com Testcontainers
└── helpers/                         Bootstrap de app, poll de jobs
```

---

## Sobre o candidato

**Guilherme Lacerda**, desenvolvedor backend disponível para a vaga de Backend Pleno na Inbazz.

| Campo | Dados |
|---|---|
| 📧 E-mail | [lacerda@kooda.dev](mailto:lacerda@kooda.dev) |
| 📱 Telefone | [+55 (37) 99837-2717](tel:+5537998372717) |
| 💼 LinkedIn | [linkedin.com/in/g-lacerda](https://linkedin.com/in/g-lacerda) |
| 💻 GitHub | [github.com/g-lacerda](https://github.com/g-lacerda) |
| 🌐 Portfólio | [kooda.dev](https://kooda.dev) |
