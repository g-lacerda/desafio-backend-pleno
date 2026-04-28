import { All, Controller, NotFoundException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

/**
 * Catch-all controller para rotas não mapeadas. Registrado por último em
 * `AppModule.controllers` para que o wildcard `*` só case com paths que nenhum
 * outro controller atendeu. Garante que 404 passe pelo `HttpExceptionFilter`
 * (e portanto pela tradução i18n) em vez do "Cannot GET /xxx" cru do Express.
 */
@ApiExcludeController()
@Controller()
export class NotFoundController {
  @All('*path')
  notFound(): never {
    throw new NotFoundException();
  }
}
