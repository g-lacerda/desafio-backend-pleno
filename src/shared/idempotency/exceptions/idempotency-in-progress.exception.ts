import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Lançada quando uma requisição com a mesma `idempotency_key` já está sendo
 * processada (estado IN_PROGRESS). Mapeia para 409 Conflict.
 */
export class IdempotencyInProgressException extends HttpException {
  constructor(key: string) {
    super({ key: 'errors.idempotency.inProgress', args: { key } }, HttpStatus.CONFLICT);
  }
}
