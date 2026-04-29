# UI — Console mínimo

Single-page HTML+CSS+JS (sem build, sem dependências) para testar todos os endpoints da API visualmente.

## Como abrir

A API tem CORS habilitado, então qualquer servidor estático local funciona. Use **uma das opções abaixo**:

### Opção 1 — npx serve (recomendada — Node já está instalado)

```bash
npx serve UI -l 8080
```

Abra `http://localhost:8080`. Backend roda na 3000, UI na 8080 — sem conflito.

### Opção 2 — VS Code Live Server

Clique direito em `UI/index.html` → "Open with Live Server".

### Opção 3 — Python (fallback se não tiver Node)

```bash
cd UI && python3 -m http.server 8080
```

## O que tem

- **Configuração no topo** (sticky): `baseUrl`, `apiKey`, `Accept-Language`. A API key fica salva em `localStorage`.
- **Criar usuário**: `POST /users`. A `api_key` retornada é salva automaticamente.
- **Login**: `POST /auth/login` — rotaciona a key e salva a nova automaticamente.
- **Webhook**: `POST /webhooks/orders` com 5 cenários pré-prontos (válido, replay, hash divergente, payload inválido, DLQ) e botão "randomizar order_id + key".
- **Listar pedidos**: `GET /orders` com filtros e paginação. Os IDs no JSON viram clicáveis pra preencher o "buscar por ID".
- **Buscar pedido por ID**: `GET /orders/:id`.
- **Métricas da fila**: `GET /queue/metrics`.
- **Health check**: `GET /health`.
- **Links rápidos**: Swagger, Bull Board, Prometheus, OpenAPI JSON, Health.

## Visualização das respostas

Cada formulário tem seu próprio painel de resposta logo abaixo, com:
- Badge de status code colorido (verde 2xx, amarelo 4xx, vermelho 5xx).
- JSON formatado com syntax highlighting.
- Em caso de erro de rede, exibe a mensagem clara (geralmente "backend não está rodando").

## Fluxo recomendado pra demo

1. Suba o backend: `npm run start:dev` (escuta em `http://localhost:3000`).
2. Abra a UI.
3. **Criar usuário** (preferredLanguage = PT_BR) → API key fica salva.
4. **Webhook → cenário "válido"** → 202 + Order persistido.
5. **Listar pedidos** → vê o pedido com status `ENRICHED` (após o worker processar).
6. **Webhook → cenário "DLQ"** → mostra o caminho de falha.
7. **Métricas da fila** → mostra os contadores.
8. **Login** com email + senha → nova API key (a anterior é invalidada).
