import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { setupApp, setupSwagger } from './app.setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const logger = app.get(Logger);
  app.useLogger(logger);

  const config = app.get(ConfigService);

  setupApp(app);
  setupSwagger(app);

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port);
  logger.log(`Application listening on port ${port}`);
}

bootstrap();
