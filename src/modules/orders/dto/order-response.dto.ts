import { ApiProperty } from '@nestjs/swagger';

export class OrderItemResponseDto {
  @ApiProperty({ example: 'ABC123' })
  sku!: string;

  @ApiProperty({ example: 2 })
  qty!: number;

  @ApiProperty({ example: '59.90', description: 'Preço unitário formatado com 2 decimais.' })
  unit_price!: string;
}

export class OrderResponseDto {
  @ApiProperty({ example: '7e9b6a45-0e6f-4f1c-9c1d-3a4f2e8e6a47', description: 'ID interno.' })
  id!: string;

  @ApiProperty({ example: 'ext-123' })
  external_order_id!: string;

  @ApiProperty({ example: { email: 'user@example.com', name: 'Ana Silva' } })
  customer!: { email: string; name: string };

  @ApiProperty({ type: [OrderItemResponseDto] })
  items!: OrderItemResponseDto[];

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiProperty({ example: '119.80' })
  total_original!: string;

  @ApiProperty({
    example: '614.80',
    nullable: true,
    description: 'Total convertido em BRL após enrichment. `null` enquanto não enriquecido.',
  })
  total_converted!: string | null;

  @ApiProperty({
    example: '5.131234',
    nullable: true,
    description: 'Taxa de câmbio aplicada (origem → BRL). `null` enquanto não enriquecido.',
  })
  conversion_rate!: string | null;

  @ApiProperty({
    example: 'RECEIVED',
    enum: ['RECEIVED', 'ENRICHING', 'ENRICHED', 'FAILED_ENRICHMENT'],
  })
  status!: string;

  @ApiProperty({
    example: null,
    nullable: true,
    description:
      'Quando `status=FAILED_ENRICHMENT`, contém a mensagem traduzida da falha (chave i18n armazenada no banco).',
  })
  failure_reason!: string | null;

  @ApiProperty({ example: '2026-04-28T20:31:42.123Z' })
  created_at!: string;
}
