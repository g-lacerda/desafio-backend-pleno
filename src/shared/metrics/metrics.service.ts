import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import {
  ENRICHMENT_ATTEMPTS_COUNTER,
  ORDERS_ENRICHED_COUNTER,
  ORDERS_RECEIVED_COUNTER,
} from './metrics.constants';

export type EnrichmentAttemptResult = 'success' | 'retry' | 'failed';

@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric(ORDERS_RECEIVED_COUNTER) private readonly received: Counter<string>,
    @InjectMetric(ORDERS_ENRICHED_COUNTER) private readonly enriched: Counter<string>,
    @InjectMetric(ENRICHMENT_ATTEMPTS_COUNTER) private readonly attempts: Counter<string>,
  ) {}

  recordOrderReceived(): void {
    this.received.inc();
  }

  recordOrderEnriched(): void {
    this.enriched.inc();
  }

  recordEnrichmentAttempt(result: EnrichmentAttemptResult): void {
    this.attempts.inc({ result });
  }
}
