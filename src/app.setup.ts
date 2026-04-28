import { INestApplication, ValidationPipe } from '@nestjs/common';
import { I18nValidationExceptionFilter, I18nValidationPipe } from 'nestjs-i18n';

/**
 * Configurações de pipes/filters globais aplicadas ANTES de app.init().
 *
 * Nota sobre rotas inexistentes: o `NotFoundController` (registrado por último em
 * `AppModule.controllers`) captura qualquer rota não mapeada e dispara
 * `NotFoundException`, que então passa pelo `HttpExceptionFilter` e é traduzida
 * via i18n. Essa é a alternativa ao middleware Express catch-all (que não funciona
 * de forma confiável porque o Express responde "Cannot GET" antes da cadeia
 * customizada).
 */
export function setupApp(app: INestApplication): void {
  app.enableCors();
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new I18nValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new I18nValidationExceptionFilter({ detailedErrors: false }));
}
