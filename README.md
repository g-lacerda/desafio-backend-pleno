# Orquestrador de Pedidos

API em NestJS para recebimento, validação e enriquecimento assíncrono de pedidos vindos de fontes externas (e-commerce, marketplaces, gateways de pagamento). Implementação do desafio backend pleno da [Inbazz](https://inbazz.com).

> **Status:** em desenvolvimento. A especificação original do desafio está em [DESAFIO.md](DESAFIO.md).

---

## Sobre o projeto

O serviço atua como ponto de entrada confiável para pedidos externos, resolvendo quatro problemas clássicos de integração:

1. **Acoplamento temporal** — webhook responde rápido (`202 Accepted`), processamento ocorre em background.
2. **Idempotência** — o mesmo `idempotency_key` recebido N vezes tem o efeito de uma única vez.
3. **Falhas em cascata** — se a API externa de enriquecimento falha, retry com backoff exponencial e Dead Letter Queue após esgotamento.
4. **Observabilidade operacional** — status persistido em banco, métricas da fila, UI de inspeção.

## Stack planejada

| Camada | Tecnologia |
|---|---|
| Framework | NestJS 10 |
| Linguagem | TypeScript |
| Banco | PostgreSQL 16 (via Prisma ORM) |
| Fila | BullMQ + Redis 7 |
| HTTP client | `@nestjs/axios` (consumo da AwesomeAPI para câmbio USD→BRL) |
| Validação | `class-validator` + `class-transformer` |
| Documentação | Swagger (`@nestjs/swagger`) em `/docs` |
| Logs | Pino estruturado |
| i18n | `nestjs-i18n` (pt-BR, en, es) |
| Auth | API Key per user (`X-API-Key` / `Bearer`, hash SHA-256 no banco) |
| Health check | `@nestjs/terminus` em `/health` |
| Rate limiting | `@nestjs/throttler` |
| Métricas | Prometheus em `/metrics` |
| Inspeção da fila | Bull Board em `/admin/queues` |
| Testes | Jest + Supertest + Testcontainers |
| Infra local | Docker + docker-compose |

## Roadmap

- [x] **Fase 1** — Fundação e infraestrutura (Docker, Prisma, i18n base, health check, Swagger).
- [x] **Fase 2** — Recebimento do pedido (webhook validado, idempotência via tabela dedicada, throttler).
- [x] **Fase 3** — Processamento assíncrono (worker, retry com backoff, DLQ, integração com AwesomeAPI).
- [ ] **Fase 4** — Usuários, autenticação por API key, endpoints de consulta e administração.
- [ ] **Fase 5** — Polimento, cobertura de testes, scripts de seed, coleções Postman, documentação final.

## Decisões técnicas relevantes

- **Valores monetários como inteiros** (centavos / micros). Sem `Decimal` / `float` em runtime, evitando qualquer ambiguidade de ponto flutuante. Convenção de mercado (Stripe, PayPal).
- **Idempotência via tabela dedicada** com replay byte-a-byte da resposta original (padrão Stripe). Evita as armadilhas de simplesmente confiar em `UNIQUE` constraint.
- **API Key per user** — modelo de auth simples e adequado pra uso machine-to-machine. Cada usuário tem sua chave e idioma de preferência (que define o idioma de retorno via i18n).
- **Arquitetura modular do NestJS** com separação clara de camadas (controller → service → repository → mapper → entity). Sem over-engineering tipo Hexagonal completa para o escopo.

## Como executar

### Pré-requisitos

- Node.js 20+
- Docker e Docker Compose
- Git

### Setup

```bash
# 1. Clone e entre no diretório
git clone <url-do-repo>
cd desafio-backend-pleno

# 2. Instale as dependências
npm install

# 3. Copie o arquivo de ambiente
cp .env.example .env

# 4. Suba Postgres + Redis em containers
docker compose up -d postgres redis

# 5. Aplique as migrations do banco
npm run prisma:migrate

# 6. Suba a aplicação em modo dev
npm run start:dev
```

A API estará disponível em `http://localhost:3000`.

### Endpoints disponíveis

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/health` | Health check (Postgres + Redis) |
| GET | `/docs` | Documentação Swagger interativa |
| POST | `/webhooks/orders` | Recebe pedido, valida, garante idempotência, persiste como `RECEIVED` e enfileira para enrichment assíncrono |

### Fluxo de processamento

Após o webhook responder `202`, o pedido é enriquecido em background pelo worker:

1. Worker consome o job da fila `enrichment-queue`.
2. Marca o pedido como `ENRICHING`.
3. Consulta a [AwesomeAPI](https://economia.awesomeapi.com.br) para obter a taxa de câmbio da moeda → BRL.
4. Calcula o `total_converted` em centavos (BRL) usando aritmética em `BigInt`.
5. Marca o pedido como `ENRICHED` com a taxa e o total convertido.

Em caso de falha:

- **Erros transientes** (timeout, 5xx): retry com backoff exponencial até `ENRICHMENT_MAX_ATTEMPTS` (default 3).
- **Esgotamento de tentativas**: pedido vai para `FAILED_ENRICHMENT` e job é movido para `enrichment-dlq` para inspeção.
- **Erros permanentes** (4xx, moeda inválida): falha imediata sem retry, mesma trajetória de DLQ.

### Rodar a aplicação inteira em Docker (opcional)

```bash
docker compose --profile app up --build
```

### Testes

```bash
# Unitários
npm test

# Cobertura
npm run test:cov

# E2E (sobe Postgres e Redis efêmeros via Testcontainers — requer Docker rodando)
npm run test:e2e
```

### Internacionalização

A resposta da API é traduzida automaticamente usando o cabeçalho `Accept-Language`. Idiomas suportados: `en`, `pt-BR`, `es`. A partir da Fase 4, o idioma também pode ser determinado pela preferência do usuário autenticado.

```bash
curl -H "Accept-Language: pt-BR" http://localhost:3000/rota-inexistente
# { "message": "Recurso não encontrado", ... }
```

## Documentação

- [DESAFIO.md](DESAFIO.md) — especificação original do desafio.
- `/docs` — Swagger UI.
- `docs/openapi.json` e `docs/postman_collection.json` — coleções importáveis (após Fase 5).
