import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE_ENRICHMENT } from '@/shared/queue/queue.constants';
import { OrdersService } from './orders.service';
import { OrderRepository } from './repositories/order.repository';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_ENRICHMENT })],
  controllers: [WebhooksController],
  providers: [OrdersService, OrderRepository],
  exports: [OrdersService, OrderRepository],
})
export class OrdersModule {}
