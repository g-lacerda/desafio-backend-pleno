/**
 * Marcador para indicar que todas as tentativas se esgotaram. Não é lançada
 * dentro do worker — é usada apenas como referência da chave i18n persistida em
 * `Order.failureReason` quando um job vai pra DLQ.
 */
export class EnrichmentFailedException extends Error {
  readonly key = 'errors.enrichment.failed';
  readonly args: Record<string, unknown>;

  constructor(attempts: number) {
    super(`Enrichment failed after ${attempts} attempts`);
    this.name = 'EnrichmentFailedException';
    this.args = { attempts };
  }
}
