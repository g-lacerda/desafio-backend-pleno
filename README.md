# Orquestrador de Pedidos

API em NestJS para recebimento, validação e enriquecimento assíncrono de pedidos vindos de fontes externas (e-commerce, marketplaces, gateways). Implementação do desafio backend pleno da [Inbazz](https://inbazz.com).

> 📚 Este README cobre o essencial pra rodar e usar a API. **Detalhamento técnico (arquitetura, decisões, auth, i18n, testes) está em [docs/](docs/)** — veja a [seção Documentação adicional](#documentação-adicional) abaixo pra navegar entre os tópicos.

> Especificação original em [DESAFIO.md](DESAFIO.md).

## Sumário

- [Visão geral](#visão-geral)
- [Stack](#stack)
- [Como rodar](#como-rodar)
- [Endpoints](#endpoints)
- [Exemplo de uso](#exemplo-de-uso)
- [Testando via Postman / Insomnia / Bruno](#testando-via-postman--insomnia--bruno)
- [Documentação adicional](#documentação-adicional)
- [Sobre o candidato](#sobre-o-candidato)

---

## Visão geral

Ponto de entrada confiável para pedidos externos. Resolve quatro problemas clássicos de integração:

1. **Acoplamento temporal** — webhook responde em `202 Accepted`, processamento ocorre em background.
2. **Idempotência** — mesma `idempotency_key` recebida N vezes tem efeito único (replay byte-a-byte).
3. **Falhas em cascata** — retry com backoff exponencial e Dead Letter Queue após esgotamento.
4. **Observabilidade** — status persistido, métricas Prometheus, UI de inspeção de filas, health check.

## Stack

NestJS 11 + TypeScript 5 · PostgreSQL 16 (Prisma 6) · BullMQ 5 + Redis 7 · `nestjs-i18n` (pt-BR/en/es) · Swagger · Prometheus · Bull Board · Jest + Testcontainers + nock · Docker Compose.

---

## Como rodar

**Pré-requisitos:** Docker + Docker Compose + Git. Nada mais.

```bash
# 1. Clone e configure
git clone https://github.com/g-lacerda/desafio-backend-pleno.git
cd desafio-backend-pleno
cp .env.example .env

# 2. Suba tudo (Postgres + Redis + Backend + UI)
docker compose up -d --build

# 3. Provisione 3 usuários demo (gera as API keys)
docker compose exec app npm run seed:users
```

O passo 3 imprime 3 API keys (uma por idioma: pt-BR, en, es). Senha de todos: `demo-pass-1234`. Cole as chaves nas variáveis `apiKeyPtBR`/`EN`/`ES` do Postman ou no campo "User API Key" da UI.

**Acesse:**

| Serviço | URL |
|---|---|
| **UI Console** | http://localhost:8080 |
| API | http://localhost:3000 |
| Swagger | http://localhost:3000/docs |
| Bull Board | http://localhost:3000/admin/queues?admin_key=&lt;ADMIN_API_KEY&gt; |
| Health | http://localhost:3000/health |
| Métricas | http://localhost:3000/metrics |

**Para parar tudo:** `docker compose down`.

> Quer modificar o código com hot reload? Veja [docs/setup-local.md](docs/setup-local.md).

---

## Endpoints

| Método | Endpoint | Auth | Descrição |
|---|---|---|---|
| `POST` | `/users` | Admin Key | Cria usuário e devolve `api_key` (uma única vez). |
| `POST` | `/auth/login` | público | Autentica `email`+`password` e **rotaciona** a API key. |
| `POST` | `/webhooks/orders` | Webhook Secret + rate-limited | Recebe pedido e enfileira para enrichment. |
| `GET` | `/orders` | User API Key | Lista pedidos com filtro `status` e paginação. |
| `GET` | `/orders/:id` | User API Key | Detalhes de um pedido. |
| `GET` | `/queue/metrics` | User API Key | Contadores das filas (`enrichment-queue`, `enrichment-dlq`). |
| `GET` | `/admin/queues` | Admin Key | Bull Board (UI HTML). |
| `GET` | `/health` | público | Health check (Postgres + Redis). |
| `GET` | `/metrics` | público | Métricas Prometheus. |
| `GET` | `/docs` | público | Swagger UI. |

> Detalhes dos 3 níveis de autenticação em [docs/auth.md](docs/auth.md).

---

## Exemplo de uso

Fluxo completo: enviar um pedido via webhook e consultá-lo já enriquecido.

```bash
# Variáveis (do .env após cp .env.example .env)
WEBHOOK_SECRET="local-dev-webhook-secret-do-not-use-in-prod"
USER_KEY="<copie do output de `npm run seed:users`>"

# 1. Envia o pedido (responde 202 imediatamente)
curl -X POST http://localhost:3000/webhooks/orders \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: $WEBHOOK_SECRET" \
  -d '{
    "order_id": "ext-demo-1",
    "customer": { "email": "ana@example.com", "name": "Ana Silva" },
    "items": [{ "sku": "ABC123", "qty": 2, "unit_price": 59.90 }],
    "currency": "USD",
    "idempotency_key": "demo-key-1"
  }'

# 2. Aguarda ~1s (worker enriquece USD → BRL via AwesomeAPI) e consulta
sleep 1
curl http://localhost:3000/orders \
  -H "Authorization: Bearer $USER_KEY"
# Retorna o pedido com status: ENRICHED, total_converted preenchido em BRL,
# conversion_rate aplicada e mensagens de erro/idioma conforme o user.
```

---

## Testando via Postman / Insomnia / Bruno

Importe diretamente no seu cliente HTTP favorito — arquivos prontos em [`collections/`](collections):

| Arquivo | Para |
|---|---|
| [`collections/postman_collection.json`](collections/postman_collection.json) | Postman (coleção curada com 7 cenários nomeados, scripts pre-request e variáveis prontas) |
| [`collections/openapi.json`](collections/openapi.json) | Insomnia, Bruno, Hoppscotch, ou qualquer ferramenta que entenda OpenAPI 3.0 |

> Guia detalhado de import + variáveis a preencher em [docs/clientes-http.md](docs/clientes-http.md).

---

## Documentação adicional

> **[Arquitetura](docs/arquitetura.md)** — fluxo do pedido, módulos e estrutura de pastas.  
> **[Decisões técnicas](docs/decisoes-tecnicas.md)** — money cents, idempotência, worker, trade-offs.  
> **[Autenticação](docs/auth.md)** — 3 níveis detalhados (user / admin / webhook secret).  
> **[Internacionalização](docs/i18n.md)** — cascata de resolução pt-BR / en / es e onde a tradução acontece.  
> **[Testes](docs/testes.md)** — estratégia unit + E2E, cobertura e cenários cobertos.  
> **[Clientes HTTP](docs/clientes-http.md)** — guia de import em Postman, Insomnia, Bruno e Hoppscotch.  
> **[Variáveis de ambiente](docs/variaveis-de-ambiente.md)** — tabela de envs (todas validadas via Joi).  
> **[Setup local](docs/setup-local.md)** — hot reload com Node 20+ pra contributors.

---

## Sobre o candidato

**Guilherme Lacerda** — desenvolvedor backend disponível para a vaga de Backend Pleno na Inbazz.

| Campo | Dados |
|---|---|
| 📧 E-mail | [lacerda@kooda.dev](mailto:lacerda@kooda.dev) |
| 📱 Telefone | [+55 (37) 99837-2717](tel:+5537998372717) |
| 💼 LinkedIn | [linkedin.com/in/g-lacerda](https://linkedin.com/in/g-lacerda) |
| 💻 GitHub | [github.com/g-lacerda](https://github.com/g-lacerda) |
| 🌐 Portfólio | [kooda.dev](https://kooda.dev) |
