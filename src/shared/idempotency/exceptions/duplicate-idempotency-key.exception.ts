import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Lançada quando uma `idempotency_key` já existente é reutilizada com um payload
 * diferente (hash não bate). Mapeia para 422 Unprocessable Entity.
 */
export class DuplicateIdempotencyKeyException extends HttpException {
  constructor(key: string) {
    super(
      { key: 'errors.idempotency.hashDivergent', args: { key } },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
