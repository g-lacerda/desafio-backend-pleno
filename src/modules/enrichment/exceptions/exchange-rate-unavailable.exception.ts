/**
 * Falha transitória na consulta da taxa de câmbio (timeout, 5xx, parse error).
 * Marcada como retryable para que o worker BullMQ aplique o backoff.
 */
export class ExchangeRateUnavailableException extends Error {
  readonly key = 'errors.enrichment.exchangeRateUnavailable';
  readonly retryable = true;

  constructor(detail?: string) {
    super(detail ?? 'Exchange rate service unavailable');
    this.name = 'ExchangeRateUnavailableException';
  }
}
