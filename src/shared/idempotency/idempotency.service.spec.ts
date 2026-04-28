import { ConfigService } from '@nestjs/config';
import { IdempotencyKey, IdempotencyStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@/shared/database/prisma.service';
import { DuplicateIdempotencyKeyException } from './exceptions/duplicate-idempotency-key.exception';
import { IdempotencyInProgressException } from './exceptions/idempotency-in-progress.exception';
import { IdempotencyService } from './idempotency.service';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let prisma: {
    idempotencyKey: {
      create: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
    };
  };

  const baseRecord = (overrides: Partial<IdempotencyKey> = {}): IdempotencyKey => ({
    key: 'key-1',
    requestHash: 'hash-1',
    status: IdempotencyStatus.COMPLETED,
    responseStatus: 202,
    responseBody: { id: 'ord-1' } as unknown as IdempotencyKey['responseBody'],
    orderId: 'ord-1',
    createdAt: new Date(Date.now() - 1000),
    completedAt: new Date(Date.now() - 500),
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      idempotencyKey: {
        create: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
    };
    const config = { getOrThrow: () => 24 } as unknown as ConfigService;
    service = new IdempotencyService(prisma as unknown as PrismaService, config);
  });

  describe('register', () => {
    it('insere e retorna isFirst=true quando chave é nova', async () => {
      prisma.idempotencyKey.create.mockResolvedValue(undefined);

      const result = await service.register('key-1', { foo: 'bar' });

      expect(result.isFirst).toBe(true);
      expect(prisma.idempotencyKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            key: 'key-1',
            status: IdempotencyStatus.IN_PROGRESS,
          }),
        }),
      );
    });

    it('retorna resposta cacheada quando hash bate e status=COMPLETED', async () => {
      const payload = { foo: 'bar' };
      const sameHash = service.hashPayload(payload);
      prisma.idempotencyKey.create.mockRejectedValue(uniqueViolation());
      prisma.idempotencyKey.findUniqueOrThrow.mockResolvedValue(
        baseRecord({ requestHash: sameHash, status: IdempotencyStatus.COMPLETED }),
      );

      const result = await service.register('key-1', payload);

      expect(result.isFirst).toBe(false);
      expect(result.cached).toEqual({ status: 202, body: { id: 'ord-1' } });
    });

    it('lança DuplicateIdempotencyKeyException quando hash diverge', async () => {
      prisma.idempotencyKey.create.mockRejectedValue(uniqueViolation());
      prisma.idempotencyKey.findUniqueOrThrow.mockResolvedValue(
        baseRecord({ requestHash: 'hash-different', status: IdempotencyStatus.COMPLETED }),
      );

      await expect(service.register('key-1', { foo: 'bar' })).rejects.toBeInstanceOf(
        DuplicateIdempotencyKeyException,
      );
    });

    it('lança IdempotencyInProgressException quando status=IN_PROGRESS e hash bate', async () => {
      const payload = { foo: 'bar' };
      const sameHash = service.hashPayload(payload);
      prisma.idempotencyKey.create.mockRejectedValue(uniqueViolation());
      prisma.idempotencyKey.findUniqueOrThrow.mockResolvedValue(
        baseRecord({ requestHash: sameHash, status: IdempotencyStatus.IN_PROGRESS }),
      );

      await expect(service.register('key-1', payload)).rejects.toBeInstanceOf(
        IdempotencyInProgressException,
      );
    });

    it('reaproveita registro em estado FAILED como retryable (UPDATE para IN_PROGRESS)', async () => {
      const payload = { foo: 'bar' };
      const sameHash = service.hashPayload(payload);
      prisma.idempotencyKey.create.mockRejectedValue(uniqueViolation());
      prisma.idempotencyKey.findUniqueOrThrow.mockResolvedValue(
        baseRecord({ requestHash: sameHash, status: IdempotencyStatus.FAILED }),
      );
      prisma.idempotencyKey.update.mockResolvedValue(undefined);

      const result = await service.register('key-1', payload);

      expect(result.isFirst).toBe(true);
      expect(prisma.idempotencyKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: IdempotencyStatus.IN_PROGRESS }),
        }),
      );
    });

    it('reaproveita registro expirado fazendo UPDATE para IN_PROGRESS', async () => {
      const payload = { foo: 'bar' };
      const sameHash = service.hashPayload(payload);
      prisma.idempotencyKey.create.mockRejectedValue(uniqueViolation());
      prisma.idempotencyKey.findUniqueOrThrow.mockResolvedValue(
        baseRecord({
          requestHash: sameHash,
          status: IdempotencyStatus.COMPLETED,
          expiresAt: new Date(Date.now() - 1000),
        }),
      );
      prisma.idempotencyKey.update.mockResolvedValue(undefined);

      const result = await service.register('key-1', payload);

      expect(result.isFirst).toBe(true);
      expect(prisma.idempotencyKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'key-1' },
          data: expect.objectContaining({ status: IdempotencyStatus.IN_PROGRESS }),
        }),
      );
    });
  });

  describe('complete', () => {
    it('atualiza status pra COMPLETED com response body e orderId', async () => {
      prisma.idempotencyKey.update.mockResolvedValue(undefined);

      await service.complete('key-1', { status: 202, body: { id: 'ord-1' } }, 'ord-1');

      expect(prisma.idempotencyKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'key-1' },
          data: expect.objectContaining({
            status: IdempotencyStatus.COMPLETED,
            responseStatus: 202,
            orderId: 'ord-1',
          }),
        }),
      );
    });
  });

  describe('fail', () => {
    it('marca status=FAILED', async () => {
      prisma.idempotencyKey.update.mockResolvedValue(undefined);
      await service.fail('key-1');
      expect(prisma.idempotencyKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'key-1' },
          data: expect.objectContaining({ status: IdempotencyStatus.FAILED }),
        }),
      );
    });
  });

  describe('hashPayload', () => {
    it('é determinístico para o mesmo objeto', () => {
      const a = service.hashPayload({ a: 1, b: 2 });
      const b = service.hashPayload({ a: 1, b: 2 });
      expect(a).toBe(b);
    });

    it('diverge quando o conteúdo muda', () => {
      const a = service.hashPayload({ a: 1 });
      const b = service.hashPayload({ a: 2 });
      expect(a).not.toBe(b);
    });
  });
});

function uniqueViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}
