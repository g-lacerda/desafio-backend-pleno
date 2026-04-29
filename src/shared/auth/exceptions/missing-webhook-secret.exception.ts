import { HttpException, HttpStatus } from '@nestjs/common';

export class MissingWebhookSecretException extends HttpException {
  constructor() {
    super({ key: 'errors.auth.missingWebhookSecret' }, HttpStatus.UNAUTHORIZED);
  }
}
