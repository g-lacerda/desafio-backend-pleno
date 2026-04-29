import { HttpException, HttpStatus } from '@nestjs/common';

export class MissingApiKeyException extends HttpException {
  constructor() {
    super({ key: 'errors.auth.missingApiKey' }, HttpStatus.UNAUTHORIZED);
  }
}
