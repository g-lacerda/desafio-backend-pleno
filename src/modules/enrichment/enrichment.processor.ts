import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, UnrecoverableError } from 'bullmq';
import { OrderRepository } from '@/modules/orders/repositories/order.repository';
import { MetricsService } from '@/shared/metrics/metrics.service';
import {
  ENRICHMENT_JOB_NAME,
  QUEUE_ENRICHMENT,
  QUEUE_ENRICHMENT_DLQ,
} from '@/shared/queue/queue.constants';
import { EnrichmentFailedException } from './exceptions/enrichment-failed.exception';
import { InvalidCurrencyException } from './exceptions/invalid-currency.exception';
import { EnrichmentService } from './enrichment.service';

export interface EnrichmentJobData {
  orderId: string;
}

@Processor(QUEUE_ENRICHMENT)
export class EnrichmentProcessor extends WorkerHost {
  private readonly logger = new Logger(EnrichmentProcessor.name);
  private readonly maxAttempts: number;

  constructor(
    private readonly enrichment: EnrichmentService,
    private readonly orders: OrderRepository,
    @InjectQueue(QUEUE_ENRICHMENT_DLQ) private readonly dlq: Queue,
    config: ConfigService,
    private readonly metrics: MetricsService,
  ) {
    super();
    this.maxAttempts = config.getOrThrow<number>('ENRICHMENT_MAX_ATTEMPTS');
  }

  async process(job: Job<EnrichmentJobData>): Promise<void> {
    const start = Date.now();
    const { orderId } = job.data;

    this.logger.log(
      { jobId: job.id, orderId, attempt: job.attemptsMade + 1 },
      'Enrichment job started',
    );

    try {
      await this.enrichment.enrich(orderId);
      this.logger.log(
        { jobId: job.id, orderId, durationMs: Date.now() - start },
        'Enrichment job completed',
      );
    } catch (error) {
      // Erros não-retryable (ex.: moeda inválida) → vão pra DLQ na primeira ocorrência.
      if (error instanceof InvalidCurrencyException) {
        throw new UnrecoverableError(error.message);
      }
      throw error;
    }
  }

  /**
   * Disparado pelo worker BullMQ quando o job falha. `OnWorkerEvent` é chamado
   * para CADA tentativa que falha, inclusive as intermediárias. Só agimos quando
   * todas as tentativas se esgotaram (ou quando `UnrecoverableError` foi lançada).
   */
  @OnWorkerEvent('failed')
  async onFailed(job: Job<EnrichmentJobData>, error: Error): Promise<void> {
    // Lemos do ConfigService porque `job.opts.attempts` nem sempre traz o valor
    // do `defaultJobOptions` da fila (depende da versão do BullMQ).
    const exhausted = job.attemptsMade >= this.maxAttempts || error.name === 'UnrecoverableError';

    if (!exhausted) {
      this.metrics.recordEnrichmentAttempt('retry');
      this.logger.warn(
        { jobId: job.id, orderId: job.data.orderId, attempt: job.attemptsMade, err: error.message },
        'Enrichment attempt failed; will retry',
      );
      return;
    }

    const failureReason = new EnrichmentFailedException(job.attemptsMade).serialize();
    await this.orders.markFailedEnrichment(job.data.orderId, failureReason);
    await this.dlq.add(ENRICHMENT_JOB_NAME, {
      orderId: job.data.orderId,
      attempts: job.attemptsMade,
      lastError: error.message,
    });

    this.metrics.recordEnrichmentAttempt('failed');
    this.logger.error(
      { jobId: job.id, orderId: job.data.orderId, attempts: job.attemptsMade, err: error.message },
      'Enrichment exhausted retries; moved to DLQ',
    );
  }
}
