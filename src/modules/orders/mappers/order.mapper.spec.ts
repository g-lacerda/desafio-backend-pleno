import { Order, OrderStatus } from '@prisma/client';
import { CreateOrderDto } from '../dto/create-order.dto';
import { OrderMapper } from './order.mapper';

describe('OrderMapper', () => {
  describe('fromDto', () => {
    it('converte DTO para dados de persistência (cents agregados)', () => {
      const dto = {
        order_id: 'ext-123',
        customer: { email: 'a@b.com', name: 'Ana' },
        items: [
          { sku: 'A', qty: 2, unit_price: 59.9 },
          { sku: 'B', qty: 1, unit_price: 10 },
        ],
        currency: 'USD',
        idempotency_key: 'k',
      } as unknown as CreateOrderDto;

      const data = OrderMapper.fromDto(dto);

      expect(data.externalOrderId).toBe('ext-123');
      expect(data.customerEmail).toBe('a@b.com');
      expect(data.customerName).toBe('Ana');
      expect(data.currency).toBe('USD');
      // 5990 * 2 + 1000 * 1 = 12980 cents
      expect(data.totalOriginalCents).toBe(12980);
      expect(data.items).toEqual([
        { sku: 'A', qty: 2, unit_price_cents: 5990 },
        { sku: 'B', qty: 1, unit_price_cents: 1000 },
      ]);
    });

    it('preserva precisão em valores limítrofes', () => {
      const dto = {
        order_id: 'ext-1',
        customer: { email: 'a@b.com', name: 'Ana' },
        items: [{ sku: 'X', qty: 3, unit_price: 0.1 + 0.2 }],
        currency: 'USD',
        idempotency_key: 'k',
      } as unknown as CreateOrderDto;

      const data = OrderMapper.fromDto(dto);
      // toCents(0.3) = 30; 30 * 3 = 90
      expect(data.totalOriginalCents).toBe(90);
    });
  });

  describe('toResponse', () => {
    it('formata centavos como strings com 2 casas', () => {
      const order: Order = {
        id: 'ord-1',
        externalOrderId: 'ext-1',
        customerEmail: 'a@b.com',
        customerName: 'Ana',
        items: [
          { sku: 'A', qty: 2, unit_price_cents: 5990 },
          { sku: 'B', qty: 1, unit_price_cents: 1000 },
        ] as unknown as Order['items'],
        currency: 'USD',
        totalOriginalCents: 12980,
        totalConvertedCents: null,
        conversionRateMicros: null,
        status: OrderStatus.RECEIVED,
        failureReason: null,
        createdAt: new Date('2026-04-28T12:00:00.000Z'),
        updatedAt: new Date('2026-04-28T12:00:00.000Z'),
      };

      const response = OrderMapper.toResponse(order);

      expect(response.id).toBe('ord-1');
      expect(response.external_order_id).toBe('ext-1');
      expect(response.customer).toEqual({ email: 'a@b.com', name: 'Ana' });
      expect(response.items).toEqual([
        { sku: 'A', qty: 2, unit_price: '59.90' },
        { sku: 'B', qty: 1, unit_price: '10.00' },
      ]);
      expect(response.currency).toBe('USD');
      expect(response.total_original).toBe('129.80');
      expect(response.total_converted).toBeNull();
      expect(response.conversion_rate).toBeNull();
      expect(response.failure_reason).toBeNull();
      expect(response.status).toBe('RECEIVED');
      expect(response.created_at).toBe('2026-04-28T12:00:00.000Z');
    });

    it('formata total_converted e conversion_rate quando enrichment foi concluído', () => {
      const order: Order = {
        id: 'ord-1',
        externalOrderId: 'ext-1',
        customerEmail: 'a@b.com',
        customerName: 'Ana',
        items: [{ sku: 'A', qty: 1, unit_price_cents: 5990 }] as unknown as Order['items'],
        currency: 'USD',
        totalOriginalCents: 5990,
        totalConvertedCents: 30689,
        conversionRateMicros: 5_123_456,
        status: OrderStatus.ENRICHED,
        failureReason: null,
        createdAt: new Date('2026-04-28T12:00:00.000Z'),
        updatedAt: new Date('2026-04-28T12:00:00.000Z'),
      };

      const response = OrderMapper.toResponse(order);

      expect(response.total_converted).toBe('306.89');
      expect(response.conversion_rate).toBe('5.123456');
      expect(response.status).toBe('ENRICHED');
    });

    it('traduz failure_reason via callback quando informado', () => {
      const order: Order = {
        id: 'ord-1',
        externalOrderId: 'ext-1',
        customerEmail: 'a@b.com',
        customerName: 'Ana',
        items: [] as unknown as Order['items'],
        currency: 'XXX',
        totalOriginalCents: 5990,
        totalConvertedCents: null,
        conversionRateMicros: null,
        status: OrderStatus.FAILED_ENRICHMENT,
        failureReason: 'errors.enrichment.failed',
        createdAt: new Date('2026-04-28T12:00:00.000Z'),
        updatedAt: new Date('2026-04-28T12:00:00.000Z'),
      };

      const response = OrderMapper.toResponse(
        order,
        (key) => `Translated:${key}`,
      );

      expect(response.failure_reason).toBe('Translated:errors.enrichment.failed');
    });

    it('devolve a chave crua de failure_reason quando não há callback', () => {
      const order: Order = {
        id: 'ord-1',
        externalOrderId: 'ext-1',
        customerEmail: 'a@b.com',
        customerName: 'Ana',
        items: [] as unknown as Order['items'],
        currency: 'XXX',
        totalOriginalCents: 5990,
        totalConvertedCents: null,
        conversionRateMicros: null,
        status: OrderStatus.FAILED_ENRICHMENT,
        failureReason: 'errors.enrichment.failed',
        createdAt: new Date('2026-04-28T12:00:00.000Z'),
        updatedAt: new Date('2026-04-28T12:00:00.000Z'),
      };

      const response = OrderMapper.toResponse(order);
      expect(response.failure_reason).toBe('errors.enrichment.failed');
    });
  });
});
