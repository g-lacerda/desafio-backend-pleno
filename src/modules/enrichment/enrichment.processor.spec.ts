import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, UnrecoverableError } from 'bullmq';
import { OrderRepository } from '@/modules/orders/repositories/order.repository';
import { EnrichmentJobData, EnrichmentProcessor } from './enrichment.processor';
import { EnrichmentService } from './enrichment.service';
import { ExchangeRateUnavailableException } from './exceptions/exchange-rate-unavailable.exception';
import { InvalidCurrencyException } from './exceptions/invalid-currency.exception';

describe('EnrichmentProcessor', () => {
  let processor: EnrichmentProcessor;
  let enrichment: jest.Mocked<EnrichmentService>;
  let orders: jest.Mocked<OrderRepository>;
  let dlq: { add: jest.Mock };
  const config = { getOrThrow: () => 3 } as unknown as ConfigService;

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  const buildJob = (overrides: Partial<Job<EnrichmentJobData>> = {}): Job<EnrichmentJobData> =>
    ({
      id: 'job-1',
      data: { orderId: 'ord-1' },
      attemptsMade: 0,
      opts: { attempts: 3 },
      ...overrides,
    }) as unknown as Job<EnrichmentJobData>;

  beforeEach(() => {
    enrichment = { enrich: jest.fn() } as unknown as jest.Mocked<EnrichmentService>;
    orders = {
      markFailedEnrichment: jest.fn(),
    } as unknown as jest.Mocked<OrderRepository>;
    dlq = { add: jest.fn() };
    processor = new EnrichmentProcessor(enrichment, orders, dlq as unknown as Queue, config);
  });

  describe('process', () => {
    it('chama EnrichmentService.enrich em caso de sucesso', async () => {
      enrichment.enrich.mockResolvedValue(undefined);

      await processor.process(buildJob());

      expect(enrichment.enrich).toHaveBeenCalledWith('ord-1');
    });

    it('converte InvalidCurrencyException em UnrecoverableError (sem retry)', async () => {
      enrichment.enrich.mockRejectedValue(new InvalidCurrencyException('XXX'));

      await expect(processor.process(buildJob())).rejects.toBeInstanceOf(UnrecoverableError);
    });

    it('propaga ExchangeRateUnavailableException pra que o BullMQ retente', async () => {
      enrichment.enrich.mockRejectedValue(new ExchangeRateUnavailableException());

      await expect(processor.process(buildJob())).rejects.toBeInstanceOf(
        ExchangeRateUnavailableException,
      );
    });
  });

  describe('onFailed', () => {
    it('apenas registra log quando ainda há tentativas (não atualiza status nem DLQ)', async () => {
      const job = buildJob({ attemptsMade: 1 });

      await processor.onFailed(job, new ExchangeRateUnavailableException());

      expect(orders.markFailedEnrichment).not.toHaveBeenCalled();
      expect(dlq.add).not.toHaveBeenCalled();
    });

    it('marca FAILED_ENRICHMENT e adiciona à DLQ quando tentativas se esgotam', async () => {
      const job = buildJob({ attemptsMade: 3 });
      const error = new ExchangeRateUnavailableException('boom');

      await processor.onFailed(job, error);

      expect(orders.markFailedEnrichment).toHaveBeenCalledWith(
        'ord-1',
        'errors.enrichment.failed',
      );
      expect(dlq.add).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ orderId: 'ord-1', attempts: 3, lastError: 'boom' }),
      );
    });

    it('processa imediatamente como exhausted quando o erro é UnrecoverableError', async () => {
      const job = buildJob({ attemptsMade: 1 });
      const unrecoverable = new UnrecoverableError('invalid currency');

      await processor.onFailed(job, unrecoverable);

      expect(orders.markFailedEnrichment).toHaveBeenCalled();
      expect(dlq.add).toHaveBeenCalled();
    });
  });
});
