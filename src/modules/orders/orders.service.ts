import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { UserNotFoundException } from '@/modules/users/exceptions/user-not-found.exception';
import { UsersService } from '@/modules/users/users.service';
import { MetricsService } from '@/shared/metrics/metrics.service';
import { ENRICHMENT_JOB_NAME, QUEUE_ENRICHMENT } from '@/shared/queue/queue.constants';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { ListOrdersResponseDto } from './dto/list-orders-response.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { OrderAlreadyExistsException } from './exceptions/order-already-exists.exception';
import { OrderNotFoundException } from './exceptions/order-not-found.exception';
import { OrderMapper } from './mappers/order.mapper';
import { OrderRepository, visibilityFilter } from './repositories/order.repository';

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
    private readonly users: UsersService,
  ) {
    this.maxAttempts = config.getOrThrow<number>('ENRICHMENT_MAX_ATTEMPTS');
    this.backoffBaseMs = config.getOrThrow<number>('ENRICHMENT_BACKOFF_BASE_MS');
  }

  async receive(dto: CreateOrderDto): Promise<OrderResponseDto> {
    // Se o webhook informou user_id, valida que o usuário existe — caso contrário
    // a FK do banco lançaria erro genérico. 422 é mais apropriado que 400 porque
    // o payload é sintaticamente válido (UUID), mas semanticamente inválido.
    if (dto.user_id) {
      const user = await this.users.findById(dto.user_id);
      if (!user) throw new UserNotFoundException(dto.user_id);
    }

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

    return OrderMapper.toResponse(order, this.makeTranslator());
  }

  async findAll(
    query: ListOrdersQueryDto,
    currentUserId: string,
    lang?: string,
  ): Promise<ListOrdersResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const visibility = visibilityFilter(currentUserId);
    const where: Prisma.OrderWhereInput = query.status
      ? { ...visibility, status: query.status }
      : visibility;

    const translate = this.makeTranslator(lang);
    const [orders, total] = await Promise.all([
      this.repository.findMany({ where, skip: (page - 1) * limit, take: limit }),
      this.repository.count(where),
    ]);

    return {
      data: orders.map((o) => OrderMapper.toResponse(o, translate)),
      meta: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async findById(id: string, currentUserId: string, lang?: string): Promise<OrderResponseDto> {
    const order = await this.repository.findVisibleById(id, currentUserId);
    if (!order) throw new OrderNotFoundException(id);
    return OrderMapper.toResponse(order, this.makeTranslator(lang));
  }

  /**
   * Cria um tradutor pro `failureReason` que:
   *  - aceita uma string serializada `{"key":"...","args":{...}}` (formato novo)
   *    e passa os args pro nestjs-i18n pra interpolar `{attempts}` e cia;
   *  - faz fallback pra tratar a string como chave crua (orders persistidos
   *    antes da serialização ou reasons sem args).
   *
   * `lang` explícito tem precedência sobre o `I18nContext` (que pode estar
   * desatualizado em rotas autenticadas, já que o resolver de user-language
   * roda como middleware antes do guard popular `req.user`).
   */
  private makeTranslator(lang?: string) {
    const effectiveLang = lang ?? I18nContext.current()?.lang;
    return (raw: string): string => {
      let key = raw;
      let args: Record<string, unknown> | undefined;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed === 'object' &&
          'key' in parsed &&
          typeof (parsed as { key: unknown }).key === 'string'
        ) {
          key = (parsed as { key: string }).key;
          const rawArgs = (parsed as { args?: unknown }).args;
          if (rawArgs && typeof rawArgs === 'object') {
            args = rawArgs as Record<string, unknown>;
            // Back-compat: orders persistidos antes da migração pra plural usavam
            // `attempts`. nestjs-i18n exige `count` pra ativar Intl.PluralRules.
            if (args.count === undefined && typeof args.attempts === 'number') {
              args = { ...args, count: args.attempts };
            }
          }
        }
      } catch {
        // raw é uma key crua — segue com `key = raw` e sem args.
      }
      const translated = this.i18n.translate<string>(key, { lang: effectiveLang, args });
      return typeof translated === 'string' ? translated : key;
    };
  }
}
