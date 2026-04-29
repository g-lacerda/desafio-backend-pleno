import { HttpException, HttpStatus } from '@nestjs/common';

export class InvalidAdminKeyException extends HttpException {
  constructor() {
    super({ key: 'errors.auth.invalidAdminKey' }, HttpStatus.UNAUTHORIZED);
  }
}
