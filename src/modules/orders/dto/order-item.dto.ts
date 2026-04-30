import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsString, Max, MaxLength, Min } from 'class-validator';
import { i18nValidationMessage as i18n } from 'nestjs-i18n';

export class OrderItemDto {
  @ApiProperty({ example: 'ABC123' })
  @IsString({ message: i18n('validation.isString') })
  @IsNotEmpty({ message: i18n('validation.isNotEmpty') })
  @MaxLength(64, { message: i18n('validation.maxLength') })
  sku!: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt({ message: i18n('validation.isInt') })
  @Min(1, { message: i18n('validation.min') })
  @Max(10_000, { message: i18n('validation.max') })
  qty!: number;

  @ApiProperty({
    example: 59.9,
    description:
      'Preço unitário em decimal (até 2 casas). É convertido para centavos internamente. ' +
      'Valor `0` é aceito intencionalmente para suportar brindes/promoções/itens grátis.',
    minimum: 0,
    maximum: 1_000_000,
  })
  @Expose({ name: 'unit_price' })
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 },
    { message: i18n('validation.maxDecimalPlaces') },
  )
  // 0 é permitido (brinde / promoção / item grátis) — não usar @Min(0.01).
  @Min(0, { message: i18n('validation.min') })
  @Max(1_000_000, { message: i18n('validation.max') })
  unit_price!: number;
}
