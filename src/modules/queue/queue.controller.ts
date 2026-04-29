import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { QueueMetricsResponseDto } from './dto/queue-metrics.dto';
import { QueueService } from './queue.service';

@ApiTags('Queue')
@ApiBearerAuth()
@Controller('queue')
export class QueueController {
  constructor(private readonly queue: QueueService) {}

  @Get('metrics')
  @ApiOperation({
    summary: 'Métricas agregadas das filas (waiting, active, completed, failed, delayed)',
  })
  @ApiOkResponse({ type: QueueMetricsResponseDto })
  metrics(): Promise<QueueMetricsResponseDto> {
    return this.queue.getMetrics();
  }
}
