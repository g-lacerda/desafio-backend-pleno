# Decisões técnicas

> Voltar pro [README](../README.md).

## Valores monetários como inteiros (`_cents` / `_micros`)

Toda quantia monetária é armazenada e operada como **inteiro na menor unidade** (centavos). Taxas de câmbio em micro-unidades (× 10⁶). Sem `Decimal`/`float`/`decimal.js` em runtime.

Por quê: elimina ambiguidade de ponto flutuante (`0.1 + 0.2 ≠ 0.3` em IEEE 754), serialização JSON é segura, aritmética é exata e rápida. Convenção universal (Stripe, PayPal, Square). Conversão usa `BigInt` na multiplicação intermediária para evitar overflow em valores grandes. Detalhes em `src/shared/money/money.utils.ts`.

## Idempotência via tabela dedicada (não UNIQUE constraint)

Implementação no padrão Stripe:

- Tabela `idempotency_keys` com hash SHA-256 do payload, status (`IN_PROGRESS`/`COMPLETED`/`FAILED`), `responseStatus`/`responseBody` cacheados, `expiresAt`.
- Replay devolve **byte-a-byte** a resposta original (não apenas "já existe").
- Detecção de **reuso indevido** (mesma chave + payload diferente) → 422.
- Estado `FAILED` é tratado como expirado (cliente pode retentar).

## Worker BullMQ com retry/DLQ tipado

- Erros transientes (5xx, timeout) → retry com backoff exponencial.
- Erros permanentes (4xx, moeda inválida) → `UnrecoverableError` BullMQ → DLQ imediato.
- `@OnWorkerEvent('failed')` marca `FAILED_ENRICHMENT` quando esgota tentativas.
- DLQ é uma fila separada (`enrichment-dlq`) sem worker, apenas armazena para inspeção.

## i18n persistido como chave (não mensagem)

Mensagens de exceções de negócio são armazenadas como **chaves i18n** (ex.: `errors.order.notFound`); a tradução acontece apenas na borda HTTP. `Order.failureReason` persiste a chave + args serializados em JSON (`{"key":"errors.enrichment.failed","args":{"count":3}}`), permitindo interpolação correta independente do idioma da requisição que vai consultar.

A pluralização usa o suporte nativo do `nestjs-i18n` via `Intl.PluralRules`: a chave i18n vira um objeto `{ one, other }` e o arg `count` ativa a regra automaticamente — `1 tentativa` no singular, `3 tentativas` no plural.

## Replay de webhook byte-a-byte

A coluna `IdempotencyKey.responseBody` é `TEXT` (não `Json`/`jsonb`) porque o Postgres reordena chaves do `jsonb` por design. Persistimos o JSON serializado **exatamente como o cliente recebeu**; no replay, o `IdempotencyInterceptor` escreve o texto cru via `res.send` e retorna `EMPTY` no observable pra evitar re-serialização do Nest. Resultado: `diff` byte-a-byte vazio entre primeira e segunda chamada com a mesma idempotency key.

## Multi-tenancy híbrido (opt-in por webhook)

`Order.userId` é uma FK opcional pra `users`. Quando o webhook envia `user_id`, o pedido pertence àquele usuário; quando omite, é global (visível pra todos). O filtro `visibilityFilter(currentUserId)` aplica `OR: [{ userId: null }, { userId: currentUser.id }]` em queries autenticadas, então o usuário corrente vê apenas os próprios + os globais.

Por que não multi-tenancy compulsório? Webhooks vêm de sistemas externos que podem ou não saber pra qual tenant o pedido pertence — forçar `user_id` quebraria integrações genéricas. Por que não global puro? Não permite isolar pedidos quando o webhook conhece o tenant. O modelo opt-in cobre ambos os casos sem ramificar o produto.

## Trade-offs assumidos

- **Validation pipes com Accept-Language em vez de user.preferredLanguage**: pipes rodam após guards mas o `I18nContext` foi setado por middleware antes do guard. Erros de validação em rotas autenticadas usam o `Accept-Language`, não a preferência do usuário. Mensagens de exceções de negócio (404, 422, etc.) usam a preferência do usuário corretamente via `HttpExceptionFilter` e GETs de `/orders` injetam a lang via `@CurrentUser()`.
- **Admin key e webhook secret como envs**: em produção real ficariam atrás de um secret manager (AWS Secrets, Vault). Mantido como env pra simplicidade de demo.
- **Sem CQRS / Event Sourcing**: escopo não justifica.
- **`unit_price = 0` é aceito**: intencional pra suportar brindes / promoções / itens grátis. Documentado no `OrderItemDto` com `@Min(0)` em vez de `@Min(0.01)`.
