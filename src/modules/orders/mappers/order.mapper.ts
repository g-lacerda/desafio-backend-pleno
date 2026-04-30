import { Order, Prisma } from '@prisma/client';
import { fromCents, toCents } from '@/shared/money/money.utils';
import { CreateOrderDto } from '../dto/create-order.dto';
import { OrderItemResponseDto, OrderResponseDto } from '../dto/order-response.dto';
import { CreateOrderData } from '../repositories/order.repository';

interface PersistedOrderItem {
  sku: string;
  qty: number;
  unit_price_cents: number;
}

const RATE_MICROS_TO_DECIMAL = 1_000_000;

/**
 * Mapper único do contexto de Orders. Faz a fronteira entre o formato decimal
 * usado nas bordas (DTO/HTTP) e o formato inteiro usado no domínio/persistência.
 */
export class OrderMapper {
  static fromDto(dto: CreateOrderDto): CreateOrderData {
    const items: PersistedOrderItem[] = dto.items.map((item) => ({
      sku: item.sku,
      qty: item.qty,
      unit_price_cents: toCents(item.unit_price),
    }));

    const totalOriginalCents = items.reduce(
      (acc, item) => acc + item.unit_price_cents * item.qty,
      0,
    );

    return {
      externalOrderId: dto.order_id,
      customerEmail: dto.customer.email,
      customerName: dto.customer.name,
      items: items as unknown as Prisma.InputJsonValue,
      currency: dto.currency,
      totalOriginalCents,
      userId: dto.user_id ?? null,
    };
  }

  /**
   * `translateReason` é um callback opcional que recebe a chave i18n persistida
   * em `Order.failureReason` e devolve a mensagem traduzida. Quando ausente,
   * a chave é devolvida como string crua (útil em testes ou contextos sem i18n).
   */
  static toResponse(
    order: Order,
    translateReason?: (key: string) => string,
  ): OrderResponseDto {
    const items = (order.items as unknown as PersistedOrderItem[]).map<OrderItemResponseDto>(
      (item) => ({
        sku: item.sku,
        qty: item.qty,
        unit_price: fromCents(item.unit_price_cents),
      }),
    );

    return {
      id: order.id,
      external_order_id: order.externalOrderId,
      customer: { email: order.customerEmail, name: order.customerName },
      items,
      currency: order.currency,
      total_original: fromCents(order.totalOriginalCents),
      total_converted:
        order.totalConvertedCents !== null ? fromCents(order.totalConvertedCents) : null,
      conversion_rate:
        order.conversionRateMicros !== null
          ? (order.conversionRateMicros / RATE_MICROS_TO_DECIMAL).toFixed(6)
          : null,
      status: order.status,
      failure_reason: order.failureReason
        ? (translateReason?.(order.failureReason) ?? order.failureReason)
        : null,
      created_at: order.createdAt.toISOString(),
    };
  }
}
