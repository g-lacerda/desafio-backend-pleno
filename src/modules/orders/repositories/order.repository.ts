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
}

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateOrderData): Promise<Order> {
    return this.prisma.order.create({ data });
  }

  findById(id: string): Promise<Order | null> {
    return this.prisma.order.findUnique({ where: { id } });
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
