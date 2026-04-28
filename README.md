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

- [ ] **Fase 1** — Fundação e infraestrutura (Docker, Prisma, i18n base, health check, Swagger).
- [ ] **Fase 2** — Recebimento do pedido (webhook validado, idempotência via tabela dedicada, throttler).
- [ ] **Fase 3** — Processamento assíncrono (worker, retry com backoff, DLQ, integração com AwesomeAPI).
- [ ] **Fase 4** — Usuários, autenticação por API key, endpoints de consulta e administração.
- [ ] **Fase 5** — Polimento, cobertura de testes, scripts de seed, coleções Postman, documentação final.

## Decisões técnicas relevantes

- **Valores monetários como inteiros** (centavos / micros). Sem `Decimal` / `float` em runtime, evitando qualquer ambiguidade de ponto flutuante. Convenção de mercado (Stripe, PayPal).
- **Idempotência via tabela dedicada** com replay byte-a-byte da resposta original (padrão Stripe). Evita as armadilhas de simplesmente confiar em `UNIQUE` constraint.
- **API Key per user** — modelo de auth simples e adequado pra uso machine-to-machine. Cada usuário tem sua chave e idioma de preferência (que define o idioma de retorno via i18n).
- **Arquitetura modular do NestJS** com separação clara de camadas (controller → service → repository → mapper → entity). Sem over-engineering tipo Hexagonal completa para o escopo.

## Como executar

> A documentação completa de execução será adicionada conforme as fases do roadmap forem concluídas.

Pré-requisitos previstos: Node.js 20+, Docker, Git.

## Documentação

- [DESAFIO.md](DESAFIO.md) — especificação original do desafio.
- `/docs` — Swagger UI (após Fase 1).
- `docs/openapi.json` e `docs/postman_collection.json` — coleções importáveis (após Fase 5).
