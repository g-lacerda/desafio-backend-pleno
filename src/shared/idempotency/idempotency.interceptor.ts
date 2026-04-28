import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { Observable, catchError, defer, from, of, switchMap, tap, throwError } from 'rxjs';
import { IDEMPOTENCY_KEY_FIELD } from './idempotency.constants';
import { IdempotencyService } from './idempotency.service';

/**
 * Garante idempotência por chave em endpoints que aceitam payloads JSON com um
 * campo `idempotency_key`. Funciona em três etapas:
 *
 * 1. Tenta registrar a chave atomicamente (`IdempotencyService.register`).
 * 2. Se for a primeira ocorrência, executa o handler e persiste a resposta.
 * 3. Se for replay com mesmo payload já concluído, devolve a resposta cacheada.
 *
 * Estados de erro (chave em IN_PROGRESS, payload divergente) são lançados como
 * exceptions tipadas pelo próprio service e propagados normalmente.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly reflector: Reflector,
  ) {
    // Reflector mantido aqui para futura extensão via decorator @SkipIdempotency()
    void this.reflector;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const body = req.body as Record<string, unknown> | undefined;
    const key = body?.[IDEMPOTENCY_KEY_FIELD];

    if (typeof key !== 'string' || key.length === 0) {
      // Sem chave: deixa a validação do DTO reportar o erro adequadamente.
      return next.handle();
    }

    return defer(() => from(this.idempotency.register(key, body))).pipe(
      switchMap((registration) => {
        if (!registration.isFirst && registration.cached) {
          res.status(registration.cached.status);
          return of(registration.cached.body);
        }

        return next.handle().pipe(
          tap({
            next: (response) => {
              const status = res.statusCode;
              const orderId = this.extractOrderId(response);
              this.idempotency.complete(key, { status, body: response }, orderId).catch((err) => {
                this.logger.error(
                  { key, err: (err as Error).message },
                  'Failed to persist idempotency completion',
                );
              });
            },
          }),
          catchError((err) => {
            // Não persistimos resposta cacheada em caso de erro do handler — apenas marcamos
            // a chave como FAILED para liberar futuras tentativas com o mesmo payload.
            this.idempotency.fail(key).catch((failErr) => {
              this.logger.error(
                { key, err: (failErr as Error).message },
                'Failed to persist idempotency failure',
              );
            });
            return throwError(() => err);
          }),
        );
      }),
      catchError((err) => {
        // Erros lançados pelo register() (DuplicateIdempotencyKeyException etc.) seguem em frente.
        if (err instanceof HttpException) {
          return throwError(() => err);
        }
        return throwError(() => err);
      }),
    );
  }

  private extractOrderId(response: unknown): string | null {
    if (response && typeof response === 'object' && 'id' in response) {
      const id = (response as { id: unknown }).id;
      return typeof id === 'string' ? id : null;
    }
    return null;
  }
}
