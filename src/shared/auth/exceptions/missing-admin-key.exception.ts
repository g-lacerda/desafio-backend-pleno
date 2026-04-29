import { HttpException, HttpStatus } from '@nestjs/common';

export class MissingAdminKeyException extends HttpException {
  constructor() {
    super({ key: 'errors.auth.missingAdminKey' }, HttpStatus.UNAUTHORIZED);
  }
}
