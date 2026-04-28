import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { ENRICHMENT_JOB_NAME, QUEUE_ENRICHMENT } from '@/shared/queue/queue.constants';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { OrderMapper } from './mappers/order.mapper';
import { OrderRepository } from './repositories/order.repository';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly maxAttempts: number;
  private readonly backoffBaseMs: number;

  constructor(
    private readonly repository: OrderRepository,
    @InjectQueue(QUEUE_ENRICHMENT) private readonly enrichmentQueue: Queue,
    config: ConfigService,
  ) {
    this.maxAttempts = config.getOrThrow<number>('ENRICHMENT_MAX_ATTEMPTS');
    this.backoffBaseMs = config.getOrThrow<number>('ENRICHMENT_BACKOFF_BASE_MS');
  }

  async receive(dto: CreateOrderDto): Promise<OrderResponseDto> {
    const data = OrderMapper.fromDto(dto);
    const order = await this.repository.create(data);

    await this.enrichmentQueue.add(
      ENRICHMENT_JOB_NAME,
      { orderId: order.id },
      {
        // Passamos attempts/backoff explicitamente porque o BullMQ não propaga de
        // forma confiável o `defaultJobOptions` da fila pra cada job adicionado.
        attempts: this.maxAttempts,
        backoff: { type: 'exponential', delay: this.backoffBaseMs },
      },
    );

    this.logger.log({ orderId: order.id, externalId: order.externalOrderId }, 'Order received');

    return OrderMapper.toResponse(order);
  }
}
