import { ApiProperty } from '@nestjs/swagger';

export class QueueCountersDto {
  @ApiProperty({ example: 3 }) waiting!: number;
  @ApiProperty({ example: 1 }) active!: number;
  @ApiProperty({ example: 142 }) completed!: number;
  @ApiProperty({ example: 5 }) failed!: number;
  @ApiProperty({ example: 0 }) delayed!: number;
}

export class QueueMetricsDto {
  @ApiProperty({ example: 'enrichment-queue' })
  name!: string;

  @ApiProperty({ type: QueueCountersDto })
  counts!: QueueCountersDto;
}

export class QueueMetricsResponseDto {
  @ApiProperty({ type: [QueueMetricsDto] })
  queues!: QueueMetricsDto[];
}
