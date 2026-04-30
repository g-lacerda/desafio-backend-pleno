import { ConfigService } from '@nestjs/config';
import { Order, OrderStatus, User } from '@prisma/client';
import { Queue } from 'bullmq';
import { I18nService } from 'nestjs-i18n';
import { UsersService } from '@/modules/users/users.service';
import { MetricsService } from '@/shared/metrics/metrics.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';
import { OrderRepository } from './repositories/order.repository';

describe('OrdersService', () => {
  let service: OrdersService;
  let repository: jest.Mocked<OrderRepository>;
  let queue: { add: jest.Mock };
  const config = {
    getOrThrow: (key: string) =>
      ({ ENRICHMENT_MAX_ATTEMPTS: 3, ENRICHMENT_BACKOFF_BASE_MS: 1000 })[key],
  } as unknown as ConfigService;
  const i18n = { translate: (k: string) => k } as unknown as I18nService;
  const metrics = {
    recordOrderReceived: jest.fn(),
    recordOrderEnriched: jest.fn(),
    recordEnrichmentAttempt: jest.fn(),
  } as unknown as MetricsService;

  const validDto = {
    order_id: 'ext-99',
    customer: { email: 'a@b.com', name: 'Ana' },
    items: [{ sku: 'X', qty: 2, unit_price: 59.9 }],
    currency: 'USD',
    idempotency_key: 'idem-1',
  } as unknown as CreateOrderDto;

  const buildOrder = (overrides: Partial<Order> = {}): Order => ({
    id: 'ord-x',
    externalOrderId: 'ext-x',
    customerEmail: 'a@b.com',
    customerName: 'Ana',
    items: [{ sku: 'X', qty: 1, unit_price_cents: 1000 }] as unknown as Order['items'],
    currency: 'USD',
    totalOriginalCents: 1000,
    totalConvertedCents: null,
    conversionRateMicros: null,
    status: OrderStatus.RECEIVED,
    failureReason: null,
    userId: null,
    createdAt: new Date('2026-04-28T00:00:00.000Z'),
    updatedAt: new Date('2026-04-28T00:00:00.000Z'),
    ...overrides,
  });

  const usersStub = {
    findById: jest.fn().mockResolvedValue(null),
  } as unknown as UsersService;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      findVisibleById: jest.fn(),
      findByExternalId: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    } as unknown as jest.Mocked<OrderRepository>;
    queue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };
    service = new OrdersService(
      repository,
      queue as unknown as Queue,
      config,
      i18n,
      metrics,
      usersStub,
    );
  });

  it('cria Order com status RECEIVED, valores em cents e enfileira job de enrichment', async () => {
    const persisted: Order = {
      id: 'ord-1',
      externalOrderId: 'ext-99',
      customerEmail: 'a@b.com',
      customerName: 'Ana',
      items: [{ sku: 'X', qty: 2, unit_price_cents: 5990 }] as unknown as Order['items'],
      currency: 'USD',
      totalOriginalCents: 11980,
      totalConvertedCents: null,
      conversionRateMicros: null,
      status: OrderStatus.RECEIVED,
      failureReason: null,
      userId: null,
      createdAt: new Date('2026-04-28T00:00:00.000Z'),
      updatedAt: new Date('2026-04-28T00:00:00.000Z'),
    };
    repository.create.mockResolvedValue(persisted);

    const response = await service.receive(validDto);

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        externalOrderId: 'ext-99',
        customerEmail: 'a@b.com',
        currency: 'USD',
        totalOriginalCents: 11980,
      }),
    );
    expect(queue.add).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ orderId: 'ord-1' }),
      expect.objectContaining({
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      }),
    );
    expect(response.id).toBe('ord-1');
    expect(response.status).toBe('RECEIVED');
    expect(response.total_original).toBe('119.80');
    expect(response.total_converted).toBeNull();
  });

  describe('findAll', () => {
    const visibilityWhere = { OR: [{ userId: null }, { userId: 'user-1' }] };

    it('aplica paginação + filtro de visibilidade (proprios + globais)', async () => {
      repository.findMany.mockResolvedValue([buildOrder({ id: 'a' }), buildOrder({ id: 'b' })]);
      repository.count.mockResolvedValue(42);

      const result = await service.findAll({ page: 2, limit: 10 }, 'user-1');

      expect(repository.findMany).toHaveBeenCalledWith({
        where: visibilityWhere,
        skip: 10,
        take: 10,
      });
      expect(result.meta).toEqual({ page: 2, limit: 10, total: 42, total_pages: 5 });
      expect(result.data).toHaveLength(2);
    });

    it('combina filtro de visibilidade com filtro por status', async () => {
      repository.findMany.mockResolvedValue([]);
      repository.count.mockResolvedValue(0);

      await service.findAll({ status: OrderStatus.ENRICHED, page: 1, limit: 20 }, 'user-1');

      expect(repository.findMany).toHaveBeenCalledWith({
        where: { ...visibilityWhere, status: OrderStatus.ENRICHED },
        skip: 0,
        take: 20,
      });
    });

    it('garante total_pages mínimo de 1 quando total=0', async () => {
      repository.findMany.mockResolvedValue([]);
      repository.count.mockResolvedValue(0);

      const result = await service.findAll({ page: 1, limit: 20 }, 'user-1');
      expect(result.meta.total_pages).toBe(1);
    });
  });

  describe('findById', () => {
    it('devolve o pedido quando visível pro user (próprio ou global)', async () => {
      (repository.findVisibleById as jest.Mock).mockResolvedValue(buildOrder({ id: 'ord-7' }));
      const result = await service.findById('ord-7', 'user-1');
      expect(result.id).toBe('ord-7');
      expect(repository.findVisibleById).toHaveBeenCalledWith('ord-7', 'user-1');
    });

    it('lança OrderNotFoundException quando não encontrado ou pertence a outro user', async () => {
      (repository.findVisibleById as jest.Mock).mockResolvedValue(null);
      await expect(service.findById('missing', 'user-1')).rejects.toMatchObject({
        getStatus: expect.any(Function),
      });
    });
  });

  describe('receive (multi-tenancy via user_id)', () => {
    it('valida user_id e lança UserNotFoundException quando user inexistente', async () => {
      (usersStub.findById as jest.Mock).mockResolvedValueOnce(null);
      const dto = { ...validDto, user_id: '00000000-0000-0000-0000-000000000999' } as CreateOrderDto;

      await expect(service.receive(dto)).rejects.toMatchObject({
        getStatus: expect.any(Function),
      });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('persiste userId no order quando user existe', async () => {
      const fakeUser = { id: 'user-1', email: 'u@e.com' } as unknown as User;
      (usersStub.findById as jest.Mock).mockResolvedValueOnce(fakeUser);
      repository.create.mockResolvedValue(buildOrder({ userId: 'user-1' }));

      const dto = { ...validDto, user_id: 'user-1' } as CreateOrderDto;
      await service.receive(dto);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1' }),
      );
    });
  });

  describe('tradução de failureReason', () => {
    it('passa key + args do JSON serializado e usa o lang explícito', async () => {
      const translate = jest.fn(
        (key: string, opts: { lang?: string; args?: Record<string, unknown> }) => {
          if (key === 'errors.enrichment.failed' && opts.lang === 'pt-BR') {
            return `Falha após ${opts.args?.count} tentativas`;
          }
          return key;
        },
      );
      const localI18n = { translate } as unknown as I18nService;
      const localService = new OrdersService(
        repository,
        queue as unknown as Queue,
        config,
        localI18n,
        metrics,
        usersStub,
      );

      (repository.findVisibleById as jest.Mock).mockResolvedValue(
        buildOrder({
          id: 'ord-fail',
          status: OrderStatus.FAILED_ENRICHMENT,
          failureReason: JSON.stringify({
            key: 'errors.enrichment.failed',
            args: { count: 3 },
          }),
        }),
      );

      const result = await localService.findById('ord-fail', 'user-1', 'pt-BR');
      expect(result.failure_reason).toBe('Falha após 3 tentativas');
      expect(translate).toHaveBeenCalledWith(
        'errors.enrichment.failed',
        expect.objectContaining({ lang: 'pt-BR', args: { count: 3 } }),
      );
    });

    it('mapeia attempts → count para back-compat com orders persistidos antes do plural', async () => {
      const translate = jest.fn(
        (_key: string, opts: { args?: Record<string, unknown> }) =>
          `count=${opts.args?.count}`,
      );
      const localI18n = { translate } as unknown as I18nService;
      const localService = new OrdersService(
        repository,
        queue as unknown as Queue,
        config,
        localI18n,
        metrics,
        usersStub,
      );

      (repository.findVisibleById as jest.Mock).mockResolvedValue(
        buildOrder({
          id: 'legacy-args',
          status: OrderStatus.FAILED_ENRICHMENT,
          // Formato antigo: arg `attempts` em vez de `count`.
          failureReason: JSON.stringify({
            key: 'errors.enrichment.failed',
            args: { attempts: 5 },
          }),
        }),
      );

      const result = await localService.findById('legacy-args', 'user-1', 'en');
      expect(result.failure_reason).toBe('count=5');
    });

    it('faz fallback pra key crua quando failureReason não é JSON (legado)', async () => {
      const translate = jest.fn((k: string) => `T:${k}`);
      const localI18n = { translate } as unknown as I18nService;
      const localService = new OrdersService(
        repository,
        queue as unknown as Queue,
        config,
        localI18n,
        metrics,
        usersStub,
      );

      (repository.findVisibleById as jest.Mock).mockResolvedValue(
        buildOrder({
          id: 'legacy',
          status: OrderStatus.FAILED_ENRICHMENT,
          failureReason: 'errors.enrichment.failed',
        }),
      );

      const result = await localService.findById('legacy', 'user-1', 'en');
      expect(result.failure_reason).toBe('T:errors.enrichment.failed');
    });
  });
});
