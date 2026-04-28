import { ConfigService } from '@nestjs/config';
import { Order, OrderStatus } from '@prisma/client';
import { Queue } from 'bullmq';
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

  const validDto = {
    order_id: 'ext-99',
    customer: { email: 'a@b.com', name: 'Ana' },
    items: [{ sku: 'X', qty: 2, unit_price: 59.9 }],
    currency: 'USD',
    idempotency_key: 'idem-1',
  } as unknown as CreateOrderDto;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByExternalId: jest.fn(),
    } as unknown as jest.Mocked<OrderRepository>;
    queue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };
    service = new OrdersService(repository, queue as unknown as Queue, config);
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
});
