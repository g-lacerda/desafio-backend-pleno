/**
 * Moeda não suportada pelo provedor (resposta 4xx). Não-retryable: nenhum retry
 * vai mudar o resultado. O processor converte para UnrecoverableError do BullMQ
 * para que o job seja imediatamente movido para a DLQ.
 */
export class InvalidCurrencyException extends Error {
  readonly key = 'errors.enrichment.invalidCurrency';
  readonly retryable = false;
  readonly args: Record<string, unknown>;

  constructor(currency: string) {
    super(`Currency ${currency} is not supported`);
    this.name = 'InvalidCurrencyException';
    this.args = { currency };
  }
}
