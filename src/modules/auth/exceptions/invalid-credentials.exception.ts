import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Mensagem genérica intencional (não diferencia "email não existe" de "senha
 * incorreta") para evitar enumeração de emails válidos.
 */
export class InvalidCredentialsException extends HttpException {
  constructor() {
    super({ key: 'errors.auth.invalidCredentials' }, HttpStatus.UNAUTHORIZED);
  }
}
