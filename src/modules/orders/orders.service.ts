import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { MetricsService } from '@/shared/metrics/metrics.service';
import { ENRICHMENT_JOB_NAME, QUEUE_ENRICHMENT } from '@/shared/queue/queue.constants';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { ListOrdersResponseDto } from './dto/list-orders-response.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { OrderAlreadyExistsException } from './exceptions/order-already-exists.exception';
import { OrderNotFoundException } from './exceptions/order-not-found.exception';
import { OrderMapper } from './mappers/order.mapper';
import { OrderRepository } from './repositories/order.repository';

const PRISMA_UNIQUE_VIOLATION = 'P2002';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly maxAttempts: number;
  private readonly backoffBaseMs: number;

  constructor(
    private readonly repository: OrderRepository,
    @InjectQueue(QUEUE_ENRICHMENT) private readonly enrichmentQueue: Queue,
    config: ConfigService,
    private readonly i18n: I18nService,
    private readonly metrics: MetricsService,
  ) {
    this.maxAttempts = config.getOrThrow<number>('ENRICHMENT_MAX_ATTEMPTS');
    this.backoffBaseMs = config.getOrThrow<number>('ENRICHMENT_BACKOFF_BASE_MS');
  }

  async receive(dto: CreateOrderDto): Promise<OrderResponseDto> {
    const data = OrderMapper.fromDto(dto);
    let order;
    try {
      order = await this.repository.create(data);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_UNIQUE_VIOLATION
      ) {
        throw new OrderAlreadyExistsException(dto.order_id);
      }
      throw error;
    }

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

    this.metrics.recordOrderReceived();
    this.logger.log({ orderId: order.id, externalId: order.externalOrderId }, 'Order received');

    return OrderMapper.toResponse(order, this.translateReason);
  }

  async findAll(query: ListOrdersQueryDto): Promise<ListOrdersResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = query.status ? { status: query.status } : undefined;

    const [orders, total] = await Promise.all([
      this.repository.findMany({ where, skip: (page - 1) * limit, take: limit }),
      this.repository.count(where),
    ]);

    return {
      data: orders.map((o) => OrderMapper.toResponse(o, this.translateReason)),
      meta: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async findById(id: string): Promise<OrderResponseDto> {
    const order = await this.repository.findById(id);
    if (!order) throw new OrderNotFoundException(id);
    return OrderMapper.toResponse(order, this.translateReason);
  }

  /**
   * Bound (arrow function) para preservar `this` quando passado como callback.
   * Lê o idioma do `I18nContext` corrente da requisição.
   */
  private translateReason = (key: string): string => {
    const lang = I18nContext.current()?.lang;
    const translated = this.i18n.translate<string>(key, { lang });
    return typeof translated === 'string' ? translated : key;
  };
}
