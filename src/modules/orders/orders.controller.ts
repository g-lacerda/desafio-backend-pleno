import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { ListOrdersResponseDto } from './dto/list-orders-response.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista pedidos com filtro opcional por status e paginação',
  })
  @ApiOkResponse({ type: ListOrdersResponseDto })
  findAll(@Query() query: ListOrdersQueryDto): Promise<ListOrdersResponseDto> {
    return this.orders.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retorna um pedido pelo ID' })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiNotFoundResponse({ description: 'Pedido não encontrado.' })
  findById(@Param('id') id: string): Promise<OrderResponseDto> {
    return this.orders.findById(id);
  }
}
