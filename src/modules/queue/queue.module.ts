import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE_ENRICHMENT, QUEUE_ENRICHMENT_DLQ } from '@/shared/queue/queue.constants';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_ENRICHMENT }, { name: QUEUE_ENRICHMENT_DLQ }),
  ],
  controllers: [QueueController],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
