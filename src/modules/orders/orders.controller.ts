import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import { languageDbToTag } from '@/shared/i18n/language.utils';
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
  findAll(
    @Query() query: ListOrdersQueryDto,
    @CurrentUser() user: User,
  ): Promise<ListOrdersResponseDto> {
    return this.orders.findAll(query, languageDbToTag(user.preferredLanguage));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retorna um pedido pelo ID' })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiNotFoundResponse({ description: 'Pedido não encontrado.' })
  findById(@Param('id') id: string, @CurrentUser() user: User): Promise<OrderResponseDto> {
    return this.orders.findById(id, languageDbToTag(user.preferredLanguage));
  }
}
