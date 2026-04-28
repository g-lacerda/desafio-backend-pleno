/**
 * Nome do campo no body do request que carrega a chave de idempotência.
 * O webhook do desafio define `idempotency_key` (snake_case por convenção do payload externo).
 */
export const IDEMPOTENCY_KEY_FIELD = 'idempotency_key';
