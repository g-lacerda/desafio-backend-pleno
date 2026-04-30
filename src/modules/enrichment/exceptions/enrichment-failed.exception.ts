/**
 * Marcador para indicar que todas as tentativas se esgotaram. Não é lançada
 * dentro do worker — é usada apenas como referência da chave i18n + args
 * persistidos em `Order.failureReason` quando um job vai pra DLQ.
 *
 * `serialize()` produz a string que vai pro banco; o mapper desserializa
 * na hora de traduzir. Usar JSON na coluna existente evita migration.
 *
 * O arg é `count` (não `attempts`) pra ativar a pluralização nativa do
 * nestjs-i18n via `Intl.PluralRules` — ver `i18n/<lang>/errors.json`.
 */
export class EnrichmentFailedException extends Error {
  readonly key = 'errors.enrichment.failed';
  readonly args: Record<string, unknown>;

  constructor(attempts: number) {
    super(`Enrichment failed after ${attempts} attempts`);
    this.name = 'EnrichmentFailedException';
    this.args = { count: attempts };
  }

  serialize(): string {
    return JSON.stringify({ key: this.key, args: this.args });
  }
}
