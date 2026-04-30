import { Injectable } from '@nestjs/common';
import { Order, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@/shared/database/prisma.service';

export interface CreateOrderData {
  externalOrderId: string;
  customerEmail: string;
  customerName: string;
  items: Prisma.InputJsonValue;
  currency: string;
  totalOriginalCents: number;
  /**
   * Opcional. Quando informado, o pedido fica visível apenas pra esse user em
   * GET /orders. Quando nulo, o pedido é global (visível pra qualquer user).
   */
  userId?: string | null;
}

/**
 * Filtro de visibilidade aplicado a queries autenticadas: o usuário corrente
 * vê os pedidos dele (`userId = currentUserId`) **mais** os pedidos globais
 * (`userId IS NULL`). Pedidos de outros users não aparecem.
 */
export const visibilityFilter = (currentUserId: string): Prisma.OrderWhereInput => ({
  OR: [{ userId: null }, { userId: currentUserId }],
});

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateOrderData): Promise<Order> {
    return this.prisma.order.create({ data });
  }

  /**
   * Lookup unfiltered. Usado pelo worker de enrichment, que precisa atualizar
   * qualquer pedido (incluindo de outros tenants) sem se preocupar com auth.
   */
  findById(id: string): Promise<Order | null> {
    return this.prisma.order.findUnique({ where: { id } });
  }

  /**
   * Lookup com filtro de visibilidade — só retorna se o pedido for do user
   * corrente OU global. Usado pelo controller pra GET /orders/:id.
   */
  findVisibleById(id: string, currentUserId: string): Promise<Order | null> {
    return this.prisma.order.findFirst({
      where: { id, ...visibilityFilter(currentUserId) },
    });
  }

  findByExternalId(externalOrderId: string): Promise<Order | null> {
    return this.prisma.order.findUnique({ where: { externalOrderId } });
  }

  findMany(params: {
    where?: Prisma.OrderWhereInput;
    skip?: number;
    take?: number;
  }): Promise<Order[]> {
    return this.prisma.order.findMany({
      where: params.where,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
    });
  }

  count(where?: Prisma.OrderWhereInput): Promise<number> {
    return this.prisma.order.count({ where });
  }

  markEnriching(id: string): Promise<Order> {
    return this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.ENRICHING, failureReason: null },
    });
  }

  markEnriched(
    id: string,
    totalConvertedCents: number,
    conversionRateMicros: number,
  ): Promise<Order> {
    return this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.ENRICHED,
        totalConvertedCents,
        conversionRateMicros,
        failureReason: null,
      },
    });
  }

  /**
   * `failureReasonKey` deve ser uma chave i18n (ex.: `errors.enrichment.failed`).
   * A tradução acontece apenas na resposta da API, no `OrderMapper`.
   */
  markFailedEnrichment(id: string, failureReasonKey: string): Promise<Order> {
    return this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.FAILED_ENRICHMENT, failureReason: failureReasonKey },
    });
  }
}
