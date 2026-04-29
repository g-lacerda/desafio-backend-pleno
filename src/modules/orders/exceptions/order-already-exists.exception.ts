import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Lançada quando o `order_id` (externo) recebido no webhook já está persistido.
 * Diferente de idempotência: idempotência protege contra mesma `idempotency_key`,
 * já esta exception protege contra `order_id` repetido com chave diferente.
 */
export class OrderAlreadyExistsException extends HttpException {
  constructor(externalOrderId: string) {
    super(
      { key: 'errors.order.alreadyExists', args: { id: externalOrderId } },
      HttpStatus.CONFLICT,
    );
  }
}
