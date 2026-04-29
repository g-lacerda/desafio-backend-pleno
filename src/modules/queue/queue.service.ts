import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUE_ENRICHMENT, QUEUE_ENRICHMENT_DLQ } from '@/shared/queue/queue.constants';
import { QueueMetricsDto, QueueMetricsResponseDto } from './dto/queue-metrics.dto';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue(QUEUE_ENRICHMENT) private readonly main: Queue,
    @InjectQueue(QUEUE_ENRICHMENT_DLQ) private readonly dlq: Queue,
  ) {}

  async getMetrics(): Promise<QueueMetricsResponseDto> {
    const [mainMetrics, dlqMetrics] = await Promise.all([
      this.collect(this.main),
      this.collect(this.dlq),
    ]);
    return { queues: [mainMetrics, dlqMetrics] };
  }

  private async collect(queue: Queue): Promise<QueueMetricsDto> {
    const counts = await queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
    );
    return {
      name: queue.name,
      counts: {
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        completed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
        delayed: counts.delayed ?? 0,
      },
    };
  }
}
