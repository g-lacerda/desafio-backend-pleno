import { HttpException, HttpStatus } from '@nestjs/common';

export class EmailAlreadyExistsException extends HttpException {
  constructor(email: string) {
    super({ key: 'errors.user.emailAlreadyExists', args: { email } }, HttpStatus.CONFLICT);
  }
}
