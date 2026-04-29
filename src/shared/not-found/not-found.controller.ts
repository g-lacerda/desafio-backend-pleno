import { All, Controller, NotFoundException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '@/shared/auth/public.decorator';

/**
 * Catch-all controller para rotas não mapeadas. Registrado por último em
 * `AppModule.controllers` para que o wildcard `*` só case com paths que nenhum
 * outro controller atendeu. Garante que 404 passe pelo `HttpExceptionFilter`
 * (e portanto pela tradução i18n) em vez do "Cannot GET /xxx" cru do Express.
 *
 * Marcado como `@Public()` para que o `ApiKeyAuthGuard` global não retorne 401
 * em rotas inexistentes — semanticamente devolver 404 é mais correto.
 */
@ApiExcludeController()
@Public()
@Controller()
export class NotFoundController {
  @All('*path')
  notFound(): never {
    throw new NotFoundException();
  }
}
