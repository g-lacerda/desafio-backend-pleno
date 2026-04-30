# Testes

> Voltar pro [README](../README.md).

## Comandos

```bash
npm test                # unit tests
npm run test:cov        # cobertura (alvo: ≥ 85%)
npm run test:e2e        # E2E com Testcontainers (requer Docker rodando)
```

**Cobertura atual:** ~95% statements / ~86% branches.

## Estratégia

### Unit (`src/**/*.spec.ts`)

Testes isolados de services, mappers, utils e guards. Mock de dependências externas via Jest. Sem rede, sem banco real.

### E2E (`test/e2e/*.e2e-spec.ts`)

Sobe Postgres + Redis efêmeros via [Testcontainers](https://testcontainers.com/), aplica as migrations e roda os fluxos completos. Cada test file usa um `BULL_PREFIX` único pra isolar filas, podendo rodar em paralelo sem conflito. AwesomeAPI mockada com [`nock`](https://github.com/nock/nock).

Helper [`postWebhook(app)`](../test/helpers/test-app.ts) já injeta o `X-Webhook-Secret` automaticamente.

## Cenários cobertos

- **Webhook**: payload válido, replay, hash divergente, validação (em 3 idiomas), throttler, autenticação por secret.
- **Worker**: golden path (USD→BRL), retry 503/503/200, falha total → DLQ, 4xx sem retry (`UnrecoverableError`).
- **Auth**: API key inválida/ausente/válida, Bearer + X-API-Key, rotas públicas, admin key e webhook secret com mensagens dedicadas.
- **Consulta**: paginação, filtro por status, 404 traduzido conforme idioma do usuário, interpolação de args (`{attempts}`).
- **Métricas**: shape correto das filas principal e DLQ.
- **Env validation**: Joi rejeita configurações inválidas (env ausente, < 16 chars, scheme errado).
