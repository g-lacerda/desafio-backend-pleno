import { NotFoundException } from '@nestjs/common';
import { Order, OrderStatus } from '@prisma/client';
import { OrderRepository } from '@/modules/orders/repositories/order.repository';
import { MetricsService } from '@/shared/metrics/metrics.service';
import { EnrichmentService } from './enrichment.service';
import { ExchangeRateClient } from './exchange-rate.client';
import { ExchangeRateUnavailableException } from './exceptions/exchange-rate-unavailable.exception';

describe('EnrichmentService', () => {
  let service: EnrichmentService;
  let repository: jest.Mocked<OrderRepository>;
  let client: jest.Mocked<ExchangeRateClient>;
  let metrics: jest.Mocked<MetricsService>;

  const buildOrder = (overrides: Partial<Order> = {}): Order => ({
    id: 'ord-1',
    externalOrderId: 'ext-1',
    customerEmail: 'a@b.com',
    customerName: 'Ana',
    items: [] as unknown as Order['items'],
    currency: 'USD',
    totalOriginalCents: 5990,
    totalConvertedCents: null,
    conversionRateMicros: null,
    status: OrderStatus.RECEIVED,
    failureReason: null,
    userId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      markEnriching: jest.fn(),
      markEnriched: jest.fn(),
      markFailedEnrichment: jest.fn(),
    } as unknown as jest.Mocked<OrderRepository>;

    client = {
      getRateToBrlMicros: jest.fn(),
    } as unknown as jest.Mocked<ExchangeRateClient>;

    metrics = {
      recordOrderEnriched: jest.fn(),
      recordEnrichmentAttempt: jest.fn(),
      recordOrderReceived: jest.fn(),
    } as unknown as jest.Mocked<MetricsService>;

    service = new EnrichmentService(repository, client, metrics);
  });

  it('marca como ENRICHING, busca taxa e marca como ENRICHED com total convertido correto', async () => {
    repository.findById.mockResolvedValue(buildOrder({ totalOriginalCents: 5990 }));
    client.getRateToBrlMicros.mockResolvedValue(5_123_456);

    await service.enrich('ord-1');

    expect(repository.markEnriching).toHaveBeenCalledWith('ord-1');
    expect(client.getRateToBrlMicros).toHaveBeenCalledWith('USD');
    // 5990 × 5_123_456 = 30_689_501_440 / 1M = 30689 (truncado)
    expect(repository.markEnriched).toHaveBeenCalledWith('ord-1', 30689, 5_123_456);
  });

  it('não chama markEnriching se status já é ENRICHING (idempotente em retries)', async () => {
    repository.findById.mockResolvedValue(buildOrder({ status: OrderStatus.ENRICHING }));
    client.getRateToBrlMicros.mockResolvedValue(5_000_000);

    await service.enrich('ord-1');

    expect(repository.markEnriching).not.toHaveBeenCalled();
    expect(repository.markEnriched).toHaveBeenCalled();
  });

  it('lança NotFoundException quando pedido não existe', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.enrich('missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(client.getRateToBrlMicros).not.toHaveBeenCalled();
  });

  it('propaga ExchangeRateUnavailableException sem marcar ENRICHED', async () => {
    repository.findById.mockResolvedValue(buildOrder());
    client.getRateToBrlMicros.mockRejectedValue(new ExchangeRateUnavailableException());

    await expect(service.enrich('ord-1')).rejects.toBeInstanceOf(
      ExchangeRateUnavailableException,
    );
    expect(repository.markEnriched).not.toHaveBeenCalled();
    expect(repository.markEnriching).toHaveBeenCalled();
  });

  it('lida com valor monetário grande sem overflow (BigInt interno)', async () => {
    // 100M USD em cents = 10_000_000_000; taxa 5.0 = 5_000_000 micros
    // Resultado em BRL cents: (10_000_000_000 × 5_000_000) / 1_000_000 = 50_000_000_000
    repository.findById.mockResolvedValue(buildOrder({ totalOriginalCents: 10_000_000_000 }));
    client.getRateToBrlMicros.mockResolvedValue(5_000_000);

    await service.enrich('ord-1');

    expect(repository.markEnriched).toHaveBeenCalledWith('ord-1', 50_000_000_000, 5_000_000);
  });
});
