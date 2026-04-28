import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsObject,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { i18nValidationMessage as i18n } from 'nestjs-i18n';
import { CustomerDto } from './customer.dto';
import { OrderItemDto } from './order-item.dto';

export class CreateOrderDto {
  @ApiProperty({ example: 'ext-123', description: 'ID do pedido na fonte externa.' })
  @Expose({ name: 'order_id' })
  @IsString({ message: i18n('validation.isString') })
  @IsNotEmpty({ message: i18n('validation.isNotEmpty') })
  @MaxLength(128, { message: i18n('validation.maxLength') })
  order_id!: string;

  @ApiProperty({ type: CustomerDto })
  @IsObject({ message: i18n('validation.isObject') })
  @ValidateNested({ message: i18n('validation.validateNested') })
  @Type(() => CustomerDto)
  customer!: CustomerDto;

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray({ message: i18n('validation.isArray') })
  @ArrayMinSize(1, { message: i18n('validation.arrayMinSize') })
  @ValidateNested({ each: true, message: i18n('validation.validateNested') })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @ApiProperty({ example: 'USD', description: 'Código ISO 4217 (3 letras).' })
  @IsString({ message: i18n('validation.isString') })
  @Length(3, 3, { message: i18n('validation.maxLength') })
  currency!: string;

  @ApiProperty({
    example: 'a3c1f2c0-8b6e-4f6f-92d4-22e5e1c4cdd9',
    description:
      'Chave única por requisição lógica. A mesma chave + payload retorna a resposta original (replay).',
  })
  @Expose({ name: 'idempotency_key' })
  @IsString({ message: i18n('validation.isString') })
  @IsNotEmpty({ message: i18n('validation.isNotEmpty') })
  @MaxLength(255, { message: i18n('validation.maxLength') })
  idempotency_key!: string;
}
