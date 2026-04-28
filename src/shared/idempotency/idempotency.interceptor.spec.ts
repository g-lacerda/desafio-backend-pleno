import { CallHandler, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of, throwError } from 'rxjs';
import { DuplicateIdempotencyKeyException } from './exceptions/duplicate-idempotency-key.exception';
import { IDEMPOTENCY_KEY_FIELD } from './idempotency.constants';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyService } from './idempotency.service';

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;
  let service: jest.Mocked<IdempotencyService>;
  let res: { statusCode: number; status: jest.Mock };

  const buildContext = (body: unknown): ExecutionContext => {
    const req = { body };
    return {
      switchToHttp: () => ({
        getRequest: <T = unknown>(): T => req as unknown as T,
        getResponse: <T = unknown>(): T => res as unknown as T,
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    service = {
      register: jest.fn(),
      complete: jest.fn().mockResolvedValue(undefined),
      fail: jest.fn().mockResolvedValue(undefined),
      hashPayload: jest.fn(),
    } as unknown as jest.Mocked<IdempotencyService>;

    res = { statusCode: 202, status: jest.fn().mockReturnThis() };
    interceptor = new IdempotencyInterceptor(service, new Reflector());
  });

  it('passa direto quando não há idempotency_key no body', async () => {
    const ctx = buildContext({ foo: 'bar' });
    const handler: CallHandler = { handle: () => of('handler-response') };

    const result = await firstValueFrom(interceptor.intercept(ctx, handler));

    expect(result).toBe('handler-response');
    expect(service.register).not.toHaveBeenCalled();
  });

  it('primeira vez: registra, executa handler e persiste resposta', async () => {
    service.register.mockResolvedValue({ isFirst: true });
    const ctx = buildContext({ [IDEMPOTENCY_KEY_FIELD]: 'k-1', foo: 'bar' });
    const handler: CallHandler = { handle: () => of({ id: 'ord-99', total: '10.00' }) };

    const result = await firstValueFrom(interceptor.intercept(ctx, handler));

    expect(result).toEqual({ id: 'ord-99', total: '10.00' });
    expect(service.register).toHaveBeenCalledWith('k-1', expect.objectContaining({ foo: 'bar' }));
    // tap dispara complete em paralelo; assertimos no microtask boundary seguinte
    await Promise.resolve();
    expect(service.complete).toHaveBeenCalledWith(
      'k-1',
      { status: 202, body: { id: 'ord-99', total: '10.00' } },
      'ord-99',
    );
  });

  it('replay: devolve resposta cacheada e ajusta status code', async () => {
    service.register.mockResolvedValue({
      isFirst: false,
      cached: { status: 202, body: { id: 'ord-cached' } },
    });
    const ctx = buildContext({ [IDEMPOTENCY_KEY_FIELD]: 'k-1', foo: 'bar' });
    const handler: CallHandler = { handle: jest.fn().mockReturnValue(of('not-called')) };

    const result = await firstValueFrom(interceptor.intercept(ctx, handler));

    expect(result).toEqual({ id: 'ord-cached' });
    expect(handler.handle).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(202);
  });

  it('propaga DuplicateIdempotencyKeyException do register', async () => {
    service.register.mockRejectedValue(new DuplicateIdempotencyKeyException('k-1'));
    const ctx = buildContext({ [IDEMPOTENCY_KEY_FIELD]: 'k-1' });
    const handler: CallHandler = { handle: () => of('not-called') };

    await expect(firstValueFrom(interceptor.intercept(ctx, handler))).rejects.toBeInstanceOf(
      DuplicateIdempotencyKeyException,
    );
  });

  it('chama fail quando o handler lança exceção', async () => {
    service.register.mockResolvedValue({ isFirst: true });
    const ctx = buildContext({ [IDEMPOTENCY_KEY_FIELD]: 'k-1' });
    const error = new HttpException('boom', HttpStatus.INTERNAL_SERVER_ERROR);
    const handler: CallHandler = { handle: () => throwError(() => error) };

    await expect(firstValueFrom(interceptor.intercept(ctx, handler))).rejects.toBe(error);
    await Promise.resolve();
    expect(service.fail).toHaveBeenCalledWith('k-1');
    expect(service.complete).not.toHaveBeenCalled();
  });
});
