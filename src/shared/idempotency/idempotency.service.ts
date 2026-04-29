import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IdempotencyKey, IdempotencyStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@/shared/database/prisma.service';
import { DuplicateIdempotencyKeyException } from './exceptions/duplicate-idempotency-key.exception';
import { IdempotencyInProgressException } from './exceptions/idempotency-in-progress.exception';

const PRISMA_UNIQUE_VIOLATION = 'P2002';

export interface CachedResponse {
  status: number;
  body: unknown;
}

export interface RegisterResult {
  /** True quando esta requisição é a primeira (deve seguir o processamento). */
  isFirst: boolean;
  /** Resposta cacheada quando isFirst=false e a chave foi processada com sucesso. */
  cached?: CachedResponse;
}

@Injectable()
export class IdempotencyService {
  private readonly ttlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.ttlMs = config.getOrThrow<number>('IDEMPOTENCY_TTL_HOURS') * 60 * 60 * 1000;
  }

  /**
   * Tenta registrar uma chave de idempotência atomicamente. Comportamento:
   *
   * - Não existe → INSERT com status=IN_PROGRESS e devolve `{ isFirst: true }`.
   *   O caller deve processar e chamar `complete()` ao final.
   * - Existe e payload bate (hash igual) e status=COMPLETED → devolve `{ isFirst: false, cached }`.
   * - Existe e payload diferente (hash divergente) → lança `DuplicateIdempotencyKeyException` (422).
   * - Existe e status=IN_PROGRESS → lança `IdempotencyInProgressException` (409).
   * - Existe e expirou → reaproveita o registro (UPDATE para IN_PROGRESS) e devolve `{ isFirst: true }`.
   */
  async register(key: string, payload: unknown): Promise<RegisterResult> {
    const requestHash = this.hashPayload(payload);
    const expiresAt = new Date(Date.now() + this.ttlMs);

    try {
      await this.prisma.idempotencyKey.create({
        data: {
          key,
          requestHash,
          status: IdempotencyStatus.IN_PROGRESS,
          expiresAt,
        },
      });
      return { isFirst: true };
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;

      // Race rara: a outra requisição que disparou o unique violation pode ainda
      // não estar visível neste snapshot (transação concorrente). Retentamos algumas
      // vezes com delay curto antes de propagar.
      const existing = await this.findExistingWithRetry(key);
      if (!existing) throw error;

      const shouldReuse =
        this.isExpired(existing) || existing.status === IdempotencyStatus.FAILED;

      if (shouldReuse) {
        await this.prisma.idempotencyKey.update({
          where: { key },
          data: {
            requestHash,
            status: IdempotencyStatus.IN_PROGRESS,
            responseStatus: null,
            responseBody: Prisma.JsonNull,
            orderId: null,
            completedAt: null,
            expiresAt,
          },
        });
        return { isFirst: true };
      }

      if (existing.requestHash !== requestHash) {
        throw new DuplicateIdempotencyKeyException(key);
      }

      if (existing.status === IdempotencyStatus.IN_PROGRESS) {
        throw new IdempotencyInProgressException(key);
      }

      return {
        isFirst: false,
        cached: {
          status: existing.responseStatus ?? 200,
          body: existing.responseBody as unknown,
        },
      };
    }
  }

  async complete(
    key: string,
    response: CachedResponse,
    orderId: string | null,
  ): Promise<void> {
    await this.prisma.idempotencyKey.update({
      where: { key },
      data: {
        status: IdempotencyStatus.COMPLETED,
        responseStatus: response.status,
        responseBody: (response.body ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        orderId,
        completedAt: new Date(),
      },
    });
  }

  async fail(key: string): Promise<void> {
    await this.prisma.idempotencyKey.update({
      where: { key },
      data: {
        status: IdempotencyStatus.FAILED,
        completedAt: new Date(),
      },
    });
  }

  hashPayload(payload: unknown): string {
    return createHash('sha256').update(JSON.stringify(payload ?? null)).digest('hex');
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === PRISMA_UNIQUE_VIOLATION
    );
  }

  private isExpired(record: IdempotencyKey): boolean {
    return record.expiresAt.getTime() < Date.now();
  }

  private async findExistingWithRetry(
    key: string,
    attempts = 3,
    delayMs = 20,
  ): Promise<IdempotencyKey | null> {
    for (let i = 0; i < attempts; i++) {
      const found = await this.prisma.idempotencyKey.findUnique({ where: { key } });
      if (found) return found;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
    return null;
  }
}
