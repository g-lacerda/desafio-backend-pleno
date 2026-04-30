# Autenticação

> Voltar pro [README](../README.md).

A API tem **três níveis de autenticação**, cada um pra um propósito distinto.

## 1. User API key (per-usuário)

Usada nos endpoints de consulta (`GET /orders`, `GET /orders/:id`, `GET /queue/metrics`).

- Formato: `sk_live_<43 chars base64url>` — gerado por `crypto.randomBytes(32).toString('base64url')` (256 bits de entropia).
- Banco guarda apenas `SHA-256(key)` indexado: lookup O(1) sem expor a chave.
- Plain text retornado **uma única vez** na criação do usuário (`POST /users`).
- Sem expiração natural — dura até ser rotacionada.
- Aceita via `Authorization: Bearer <key>` ou header `X-API-Key`.

### Recuperação se perder a chave

`POST /auth/login` com `email` + `password` (bcrypt) gera **nova API key** e invalida a anterior. Não diferenciamos "email não existe" de "senha incorreta" no erro 401 (mensagem genérica `errors.auth.invalidCredentials` para evitar enumeração).

> Por que não devolver a mesma key? O servidor guarda só o hash SHA-256 — impossível recuperar o plaintext.

## 2. Admin key (compartilhada)

Segredo único compartilhado, vem da env `ADMIN_API_KEY` (mín 16 chars). Usada em:
- `POST /users` — provisionar novos usuários
- `GET /admin/queues` — Bull Board pra inspecionar/retentar/descartar jobs

Aceita via `X-Admin-Key` ou `Authorization: Bearer <ADMIN_API_KEY>`. O Bull Board (Express middleware) também aceita query param `?admin_key=...` e cookie pra fluxo de navegação direta no browser.

## 3. Webhook secret (compartilhado)

Segredo compartilhado com sistemas externos que invocam `POST /webhooks/orders`, vem da env `WEBHOOK_SECRET` (mín 16 chars). Aceita via `X-Webhook-Secret` ou `Authorization: Bearer <WEBHOOK_SECRET>`.

### Multi-tenancy opcional via webhook

O payload do webhook aceita um campo opcional `user_id` (UUID v4 de um usuário existente):

- **Com `user_id`**: o pedido fica visível **apenas** pra esse usuário em GET /orders e GET /orders/:id. Outros users recebem 404 ao tentar acessar.
- **Sem `user_id`**: o pedido é **global** — todos os usuários autenticados veem.

Validamos que o `user_id` aponta pra um user existente; caso contrário a request retorna 422 com `errors.user.notFound` traduzido. Esse modelo casa com webhooks que vêm de marketplaces/tenants distintos sem forçar multi-tenancy completo: integrações públicas continuam funcionando sem alteração (omitindo o campo).

## Resumo

| Tipo | Origem | Endpoints | Headers aceitos |
|---|---|---|---|
| User API key | Gerada por usuário | `/orders`, `/queue/metrics`, `/auth/*` | `Authorization: Bearer`, `X-API-Key` |
| Admin key | Env `ADMIN_API_KEY` | `/users`, `/admin/queues` | `X-Admin-Key`, `Authorization: Bearer` |
| Webhook secret | Env `WEBHOOK_SECRET` | `/webhooks/orders` | `X-Webhook-Secret`, `Authorization: Bearer` |

Em produção real, as duas envs ficariam atrás de um secret manager (AWS Secrets, Vault, etc.).
