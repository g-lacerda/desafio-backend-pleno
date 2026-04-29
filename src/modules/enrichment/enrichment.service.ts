import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { MetricsService } from '@/shared/metrics/metrics.service';
import { convertCents } from '@/shared/money/money.utils';
import { OrderRepository } from '@/modules/orders/repositories/order.repository';
import { ExchangeRateClient } from './exchange-rate.client';

@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);

  constructor(
    private readonly repository: OrderRepository,
    private readonly client: ExchangeRateClient,
    private readonly metrics: MetricsService,
  ) {}

  /**
   * Executa o enriquecimento completo para um pedido:
   *
   * 1. Marca o pedido como ENRICHING.
   * 2. Consulta a taxa de câmbio na AwesomeAPI.
   * 3. Calcula `totalConvertedCents` usando aritmética em BigInt.
   * 4. Atualiza o pedido para ENRICHED com taxa e total convertido.
   *
   * Em caso de erro, propaga a exception (o processor decide se vai pra retry ou DLQ).
   */
  async enrich(orderId: string): Promise<void> {
    const order = await this.repository.findById(orderId);
    if (!order) {
      throw new NotFoundException({ key: 'errors.order.notFound', args: { id: orderId } });
    }

    if (order.status === OrderStatus.RECEIVED) {
      await this.repository.markEnriching(orderId);
    }

    const rateMicros = await this.client.getRateToBrlMicros(order.currency);
    const totalConvertedCents = convertCents(order.totalOriginalCents, rateMicros);

    await this.repository.markEnriched(orderId, totalConvertedCents, rateMicros);

    this.metrics.recordOrderEnriched();
    this.metrics.recordEnrichmentAttempt('success');
    this.logger.log(
      { orderId, currency: order.currency, rateMicros, totalConvertedCents },
      'Order enriched successfully',
    );
  }
}
