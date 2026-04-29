import { HttpException, HttpStatus } from '@nestjs/common';

export class InvalidApiKeyException extends HttpException {
  constructor() {
    super({ key: 'errors.auth.invalidApiKey' }, HttpStatus.UNAUTHORIZED);
  }
}
