import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrdersModule } from '@/modules/orders/orders.module';
import {
  ENRICHMENT_JOB_NAME,
  QUEUE_ENRICHMENT,
  QUEUE_ENRICHMENT_DLQ,
} from '@/shared/queue/queue.constants';
import { EnrichmentProcessor } from './enrichment.processor';
import { EnrichmentService } from './enrichment.service';
import { ExchangeRateClient } from './exchange-rate.client';

@Module({
  imports: [
    HttpModule,
    OrdersModule,
    BullModule.registerQueueAsync({
      name: QUEUE_ENRICHMENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        defaultJobOptions: {
          attempts: config.getOrThrow<number>('ENRICHMENT_MAX_ATTEMPTS'),
          backoff: {
            type: 'exponential',
            delay: config.getOrThrow<number>('ENRICHMENT_BACKOFF_BASE_MS'),
          },
          removeOnComplete: { age: 86400, count: 1000 },
          removeOnFail: { age: 86400, count: 1000 },
        },
      }),
    }),
    BullModule.registerQueue({
      name: QUEUE_ENRICHMENT_DLQ,
      defaultJobOptions: {
        // DLQ não tem worker; jobs ficam armazenados pra inspeção (Bull Board, queue metrics).
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false,
      },
    }),
  ],
  providers: [ExchangeRateClient, EnrichmentService, EnrichmentProcessor],
  exports: [ExchangeRateClient, EnrichmentService],
})
export class EnrichmentModule {
  static readonly JOB_NAME = ENRICHMENT_JOB_NAME;
}
