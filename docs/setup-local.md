# Setup local (hot reload)

> Voltar pro [README](../README.md).

Use esse fluxo apenas se for **modificar o código** e quiser `nest start --watch`. Pra apenas testar/avaliar a API, use o caminho Docker do [README](../README.md).

## Pré-requisitos extras

Além de Docker + Git (já requeridos pelo caminho principal):

| Ferramenta | Versão | Como instalar |
|---|---|---|
| **Node.js** | 20+ | [nvm](https://github.com/nvm-sh/nvm) (Linux/macOS), [nvm-windows](https://github.com/coreybutler/nvm-windows) ou [nodejs.org](https://nodejs.org/) |

## Passos

```bash
# 1. Clone, configure e instale
git clone https://github.com/g-lacerda/desafio-backend-pleno.git
cd desafio-backend-pleno
cp .env.example .env
npm install

# 2. Suba só a infra (Postgres + Redis)
docker compose up -d postgres redis

# 3. Aplique as migrations
npm run prisma:migrate

# 4. Suba o backend em watch mode
npm run start:dev

# 5. (Em outro terminal) Suba a UI
npx serve UI -l 8080

# 6. (Em outro terminal) Provisione usuários e dispare cenários
npm run seed:users
npm run seed:webhook        # ou outras variações
```

## Cenários de webhook disponíveis

```bash
npm run seed:webhook                          # 1 pedido válido
npm run seed:webhook -- --scenario=duplicate  # replay (mesma chave 2x)
npm run seed:webhook -- --scenario=hash       # hash divergente (422)
npm run seed:webhook -- --scenario=invalid    # payload inválido (400)
npm run seed:webhook:load                     # 50 pedidos paralelos
npm run seed:webhook:dlq                      # moeda AFN → vai pra DLQ
npm run seed:webhook:all                      # roda todos os cenários
```

## URLs (mesmo do caminho Docker)

| Serviço | URL |
|---|---|
| UI Console | http://localhost:8080 |
| API | http://localhost:3000 |
| Swagger | http://localhost:3000/docs |
| Bull Board | http://localhost:3000/admin/queues?admin_key=<ADMIN_API_KEY> |
| Health | http://localhost:3000/health |
| Métricas Prometheus | http://localhost:3000/metrics |
