import { OrderStatus } from '@prisma/client';
import { PrismaService } from '@/shared/database/prisma.service';
import { CreateOrderData, OrderRepository } from './order.repository';

describe('OrderRepository', () => {
  let repository: OrderRepository;
  let prisma: {
    order: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      order: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    };
    repository = new OrderRepository(prisma as unknown as PrismaService);
  });

  it('create encaminha dados pra prisma.order.create', async () => {
    const data: CreateOrderData = {
      externalOrderId: 'ext-1',
      customerEmail: 'a@b.com',
      customerName: 'Ana',
      items: [{ sku: 'A', qty: 1, unit_price_cents: 1000 }] as unknown as CreateOrderData['items'],
      currency: 'USD',
      totalOriginalCents: 1000,
    };
    prisma.order.create.mockResolvedValue({ id: 'ord-1', status: OrderStatus.RECEIVED });

    await repository.create(data);

    expect(prisma.order.create).toHaveBeenCalledWith({ data });
  });

  it('findById busca por id', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'ord-1' });
    await repository.findById('ord-1');
    expect(prisma.order.findUnique).toHaveBeenCalledWith({ where: { id: 'ord-1' } });
  });

  it('findByExternalId busca por externalOrderId', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'ord-1' });
    await repository.findByExternalId('ext-1');
    expect(prisma.order.findUnique).toHaveBeenCalledWith({ where: { externalOrderId: 'ext-1' } });
  });

  it('markEnriching atualiza status para ENRICHING', async () => {
    prisma.order.update.mockResolvedValue({ id: 'ord-1' });
    await repository.markEnriching('ord-1');
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'ord-1' },
      data: { status: OrderStatus.ENRICHING, failureReason: null },
    });
  });

  it('markEnriched persiste totalConvertedCents e conversionRateMicros', async () => {
    prisma.order.update.mockResolvedValue({ id: 'ord-1' });
    await repository.markEnriched('ord-1', 30689, 5_123_456);
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'ord-1' },
      data: {
        status: OrderStatus.ENRICHED,
        totalConvertedCents: 30689,
        conversionRateMicros: 5_123_456,
        failureReason: null,
      },
    });
  });

  it('markFailedEnrichment persiste a chave i18n em failureReason', async () => {
    prisma.order.update.mockResolvedValue({ id: 'ord-1' });
    await repository.markFailedEnrichment('ord-1', 'errors.enrichment.failed');
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'ord-1' },
      data: {
        status: OrderStatus.FAILED_ENRICHMENT,
        failureReason: 'errors.enrichment.failed',
      },
    });
  });
});
