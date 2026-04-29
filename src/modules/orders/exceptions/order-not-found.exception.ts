import { HttpException, HttpStatus } from '@nestjs/common';

export class OrderNotFoundException extends HttpException {
  constructor(id: string) {
    super({ key: 'errors.order.notFound', args: { id } }, HttpStatus.NOT_FOUND);
  }
}
