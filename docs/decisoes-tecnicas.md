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

Mensagens de exceções de negócio são armazenadas como **chaves i18n** (ex.: `errors.order.notFound`); a tradução acontece apenas na borda HTTP. `Order.failureReason` persiste a chave + args serializados em JSON (`{"key":"errors.enrichment.failed","args":{"attempts":3}}`), permitindo interpolação correta independente do idioma da requisição que vai consultar.

## Trade-offs assumidos

- **Validation pipes com Accept-Language em vez de user.preferredLanguage**: pipes rodam após guards mas o `I18nContext` foi setado por middleware antes do guard. Erros de validação em rotas autenticadas usam o `Accept-Language`, não a preferência do usuário. Mensagens de exceções de negócio (404, 422, etc.) usam a preferência do usuário corretamente via `HttpExceptionFilter` e GETs de `/orders` injetam a lang via `@CurrentUser()`.
- **Admin key e webhook secret como envs**: em produção real ficariam atrás de um secret manager (AWS Secrets, Vault). Mantido como env pra simplicidade de demo.
- **Sem CQRS / Event Sourcing**: escopo não justifica.
