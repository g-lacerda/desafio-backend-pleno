import { HttpException, HttpStatus } from '@nestjs/common';

export class InvalidWebhookSecretException extends HttpException {
  constructor() {
    super({ key: 'errors.auth.invalidWebhookSecret' }, HttpStatus.UNAUTHORIZED);
  }
}
