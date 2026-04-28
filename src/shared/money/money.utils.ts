/**
 * Convenção monetária do projeto: valores em moeda são representados como inteiros
 * na menor unidade (centavos). Taxas de câmbio são representadas como inteiros
 * escalados por 10⁶ (micro-unidades). Esta camada é o anti-corruption layer entre
 * o formato decimal usado nas bordas (DTO/HTTP) e o formato inteiro usado no
 * domínio e na persistência. Detalhes em PLANO.md §5.1.
 */

const CENTS_SCALE = 100;
const MICROS_SCALE = 1_000_000;
const MICROS_SCALE_BIGINT = 1_000_000n;

/**
 * Converte um valor decimal (ex.: 59.90) para centavos (ex.: 5990).
 * O `Math.round` é proteção contra erros de ponto flutuante: `59.9 * 100 = 5989.999...`.
 */
export const toCents = (value: number): number => Math.round(value * CENTS_SCALE);

/**
 * Formata centavos como string decimal com 2 casas (ex.: 5990 → "59.90").
 * Retornar string evita problemas de serialização JSON com floats.
 */
export const fromCents = (cents: number): string => (cents / CENTS_SCALE).toFixed(2);

/**
 * Converte uma taxa de câmbio decimal (ex.: 5.123456) em micro-unidades (ex.: 5_123_456).
 */
export const toRateMicros = (rate: number): number => Math.round(rate * MICROS_SCALE);

/**
 * Aplica uma taxa em micros sobre um valor em cents, retornando o resultado em cents.
 * Usa BigInt na multiplicação intermediária para evitar overflow em valores grandes
 * (cents × micros pode ultrapassar 2^53).
 */
export const convertCents = (originalCents: number, rateMicros: number): number => {
  const result = (BigInt(originalCents) * BigInt(rateMicros)) / MICROS_SCALE_BIGINT;
  return Number(result);
};
