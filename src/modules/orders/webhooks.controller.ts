import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { IdempotencyInterceptor } from '@/shared/idempotency/idempotency.interceptor';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { OrdersService } from './orders.service';

@ApiTags('Webhooks')
@Controller('webhooks/orders')
@UseGuards(ThrottlerGuard)
export class WebhooksController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({
    summary: 'Recebe um pedido vindo de fonte externa',
    description:
      'Endpoint público invocado por sistemas externos (e-commerce, marketplaces, gateways). ' +
      'Valida o payload, garante idempotência via tabela dedicada (replay byte-a-byte para a ' +
      'mesma chave + payload, 422 para hash divergente, 409 enquanto IN_PROGRESS) e persiste o ' +
      'pedido com status RECEIVED. O processamento é assíncrono e ocorre via fila (Fase 3).',
  })
  @ApiAcceptedResponse({ description: 'Pedido aceito para processamento.', type: OrderResponseDto })
  @ApiBadRequestResponse({ description: 'Payload inválido.' })
  @ApiConflictResponse({ description: 'Outra requisição com a mesma chave está em processamento.' })
  @ApiUnprocessableEntityResponse({
    description: 'Chave de idempotência reutilizada com payload diferente.',
  })
  @ApiTooManyRequestsResponse({ description: 'Limite de requisições excedido.' })
  async receive(@Body() dto: CreateOrderDto): Promise<OrderResponseDto> {
    return this.orders.receive(dto);
  }
}
