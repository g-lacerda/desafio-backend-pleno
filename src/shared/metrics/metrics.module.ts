import { Global, Module } from '@nestjs/common';
import {
  PrometheusModule,
  makeCounterProvider,
  makeGaugeProvider,
} from '@willsoto/nestjs-prometheus';
import {
  ENRICHMENT_ATTEMPTS_COUNTER,
  ORDERS_BY_STATUS_GAUGE,
  ORDERS_ENRICHED_COUNTER,
  ORDERS_RECEIVED_COUNTER,
} from './metrics.constants';
import { MetricsService } from './metrics.service';

@Global()
@Module({
  imports: [
    PrometheusModule.register({
      // /metrics é exposto sob /metrics
      defaultMetrics: { enabled: true },
    }),
  ],
  providers: [
    makeCounterProvider({
      name: ORDERS_RECEIVED_COUNTER,
      help: 'Total de pedidos recebidos via webhook',
    }),
    makeCounterProvider({
      name: ORDERS_ENRICHED_COUNTER,
      help: 'Total de pedidos enriquecidos com sucesso',
    }),
    makeCounterProvider({
      name: ENRICHMENT_ATTEMPTS_COUNTER,
      help: 'Total de tentativas de enrichment, rotuladas por resultado',
      labelNames: ['result'],
    }),
    makeGaugeProvider({
      name: ORDERS_BY_STATUS_GAUGE,
      help: 'Quantidade atual de pedidos agrupados por status',
      labelNames: ['status'],
    }),
    MetricsService,
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
