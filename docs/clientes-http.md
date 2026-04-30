# Testando via Postman / Insomnia / Bruno

> Voltar pro [README](../README.md).

A pasta [`collections/`](../collections) tem 2 arquivos prontos pra importar em qualquer cliente HTTP:

| Arquivo | Formato | Para quem |
|---|---|---|
| [`collections/postman_collection.json`](../collections/postman_collection.json) | Postman Collection v2.1 | Usuários do Postman (com cenários nomeados, scripts pre-request e variáveis prontas) |
| [`collections/openapi.json`](../collections/openapi.json) | OpenAPI 3.0 | Insomnia, Bruno, Hoppscotch, Swagger UI, qualquer ferramenta que entenda OpenAPI |

A coleção Postman foi **curada à mão** e tem mais cenários explícitos (replay, hash divergente, falha assíncrona vs síncrona, mensagens em cada idioma). O OpenAPI é **gerado automaticamente** a partir dos decorators do Swagger no código (regenere com `npm run docs:export`).

---

## Postman

1. **Postman → Import** → arrasta `collections/postman_collection.json`.
2. Na coleção importada, abra a aba **Variables** e preencha:
   - `adminKey` ← valor da env `ADMIN_API_KEY` (necessária para `POST /users` e Bull Board).
   - `webhookSecret` ← valor da env `WEBHOOK_SECRET` (necessária para `POST /webhooks/orders`).
3. Rode o seed pra criar os 3 usuários demo:
   ```bash
   docker compose exec app npm run seed:users
   ```
4. Cole as 3 API keys impressas nas variáveis `apiKeyPtBR`, `apiKeyEN`, `apiKeyES` da coleção.
5. Use os endpoints. As mensagens de erro virão no idioma do usuário escolhido.

A coleção tem 7 cenários de webhook deixando explícito o status code esperado em cada um (✓ 202 sucesso, ⚠ 202 + DLQ assíncrono, ✗ 400/401/422), além de cenários de auth, consulta e métricas.

---

## Insomnia

1. **Application → Preferences → Data → Import Data → From File** → selecione `collections/openapi.json`.
2. Crie um environment com as variáveis:
   ```json
   {
     "baseUrl": "http://localhost:3000",
     "adminKey": "<valor de ADMIN_API_KEY>",
     "webhookSecret": "<valor de WEBHOOK_SECRET>",
     "userKey": "<copie do output de seed:users>"
   }
   ```
3. Em cada request, configure os headers conforme o tipo de auth (ver [docs/auth.md](auth.md)):
   - `Authorization: Bearer {{userKey}}` para `/orders`, `/queue/metrics`.
   - `X-Admin-Key: {{adminKey}}` para `/users`, `/admin/queues`.
   - `X-Webhook-Secret: {{webhookSecret}}` para `/webhooks/orders`.

---

## Bruno

1. **Collection → Import → OpenAPI V3 (.json)** → selecione `collections/openapi.json`.
2. Crie um environment seguindo o mesmo padrão do Insomnia.

Bruno mantém a coleção como arquivos `.bru` no disco — pode versionar junto com o código se quiser.

---

## Hoppscotch

1. **Settings → Import/Export → Import → OpenAPI** → cole o conteúdo de `collections/openapi.json`.
2. Configure os headers e a env globalmente.

---

## Variáveis necessárias (resumo)

Independente do cliente:

| Variável | Valor | Onde achar |
|---|---|---|
| `baseUrl` | `http://localhost:3000` | (default) |
| `adminKey` | `ADMIN_API_KEY` do `.env` | `.env` ou docker-compose |
| `webhookSecret` | `WEBHOOK_SECRET` do `.env` | `.env` ou docker-compose |
| `apiKeyPtBR` / `apiKeyEN` / `apiKeyES` | Chaves dos usuários demo | Output de `npm run seed:users` |

---

## Smoke test rápido (qualquer cliente)

Sequência mínima pra confirmar que tudo está funcionando:

1. **Health** — `GET http://localhost:3000/health` → deve retornar `200` com Postgres + Redis OK.
2. **Webhook** — `POST /webhooks/orders` com `X-Webhook-Secret`, payload válido → `202 Accepted`.
3. **Aguarde ~1s** (worker enriquece em background).
4. **Listar pedidos** — `GET /orders` com `Authorization: Bearer <userKey>` → ver o pedido com `status: ENRICHED` e `total_converted` em BRL.
5. **Bull Board** — abra `http://localhost:3000/admin/queues?admin_key=<ADMIN_API_KEY>` no browser → ver as filas vazias (ou com jobs enriquecidos no histórico).
