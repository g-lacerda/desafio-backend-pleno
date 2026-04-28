import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nModule,
  QueryResolver,
} from 'nestjs-i18n';
import * as path from 'path';
import { envValidationSchema } from './shared/config/env.validation';
import { buildLoggerOptions } from './shared/logger/logger.config';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { NotFoundModule } from './shared/not-found/not-found.module';
import { PrismaModule } from './shared/database/prisma.module';
import { IdempotencyModule } from './shared/idempotency/idempotency.module';
import { HealthModule } from './modules/health/health.module';
import { OrdersModule } from './modules/orders/orders.module';
import { EnrichmentModule } from './modules/enrichment/enrichment.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    LoggerModule.forRootAsync({
      useFactory: () => buildLoggerOptions(process.env.NODE_ENV ?? 'development'),
    }),
    I18nModule.forRoot({
      fallbackLanguage: process.env.DEFAULT_LANGUAGE ?? 'en',
      loaderOptions: {
        path: path.join(process.cwd(), 'i18n'),
        watch: process.env.NODE_ENV === 'development',
      },
      resolvers: [
        new QueryResolver(['lang']),
        new HeaderResolver(['x-lang']),
        AcceptLanguageResolver,
      ],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.getOrThrow<number>('WEBHOOK_THROTTLE_TTL_SECONDS') * 1000,
            limit: config.getOrThrow<number>('WEBHOOK_THROTTLE_LIMIT'),
          },
        ],
        // Mensagem é chave i18n; HttpExceptionFilter traduz no idioma resolvido.
        errorMessage: 'errors.common.tooManyRequests',
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.getOrThrow<string>('REDIS_HOST'),
          port: config.getOrThrow<number>('REDIS_PORT'),
        },
        // Prefix permite isolar instâncias (útil para testes E2E rodando em paralelo
        // contra o mesmo Redis). Default 'bull' em produção.
        prefix: config.get<string>('BULL_PREFIX') ?? 'bull',
      }),
    }),
    PrismaModule,
    IdempotencyModule,
    HealthModule,
    OrdersModule,
    EnrichmentModule,
    // NotFoundModule precisa ser o ÚLTIMO import: seu wildcard `@All('*path')`
    // captura qualquer rota não atendida pelos módulos anteriores.
    NotFoundModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
