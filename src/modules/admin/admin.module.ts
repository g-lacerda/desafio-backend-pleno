import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE_ENRICHMENT, QUEUE_ENRICHMENT_DLQ } from '@/shared/queue/queue.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_ENRICHMENT }, { name: QUEUE_ENRICHMENT_DLQ }),
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature(
      { name: QUEUE_ENRICHMENT, adapter: BullMQAdapter },
      { name: QUEUE_ENRICHMENT_DLQ, adapter: BullMQAdapter },
    ),
  ],
})
export class AdminModule {}
