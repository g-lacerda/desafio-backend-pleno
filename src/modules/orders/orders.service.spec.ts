import { ConfigService } from '@nestjs/config';
import { Order, OrderStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { I18nService } from 'nestjs-i18n';
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
    createdAt: new Date('2026-04-28T00:00:00.000Z'),
    updatedAt: new Date('2026-04-28T00:00:00.000Z'),
    ...overrides,
  });

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByExternalId: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    } as unknown as jest.Mocked<OrderRepository>;
    queue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };
    service = new OrdersService(repository, queue as unknown as Queue, config, i18n, metrics);
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
    it('aplica paginação e devolve metadados', async () => {
      repository.findMany.mockResolvedValue([buildOrder({ id: 'a' }), buildOrder({ id: 'b' })]);
      repository.count.mockResolvedValue(42);

      const result = await service.findAll({ page: 2, limit: 10 });

      expect(repository.findMany).toHaveBeenCalledWith({
        where: undefined,
        skip: 10,
        take: 10,
      });
      expect(result.meta).toEqual({ page: 2, limit: 10, total: 42, total_pages: 5 });
      expect(result.data).toHaveLength(2);
    });

    it('aplica filtro por status quando informado', async () => {
      repository.findMany.mockResolvedValue([]);
      repository.count.mockResolvedValue(0);

      await service.findAll({ status: OrderStatus.ENRICHED, page: 1, limit: 20 });

      expect(repository.findMany).toHaveBeenCalledWith({
        where: { status: OrderStatus.ENRICHED },
        skip: 0,
        take: 20,
      });
    });

    it('garante total_pages mínimo de 1 quando total=0', async () => {
      repository.findMany.mockResolvedValue([]);
      repository.count.mockResolvedValue(0);

      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.meta.total_pages).toBe(1);
    });
  });

  describe('findById', () => {
    it('devolve o pedido quando encontrado', async () => {
      repository.findById.mockResolvedValue(buildOrder({ id: 'ord-7' }));
      const result = await service.findById('ord-7');
      expect(result.id).toBe('ord-7');
    });

    it('lança OrderNotFoundException quando não encontrado', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.findById('missing')).rejects.toMatchObject({
        getStatus: expect.any(Function),
      });
    });
  });
});
