import { HttpException, HttpStatus } from '@nestjs/common';

export class UserNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      { key: 'errors.user.notFound', args: { id } },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
