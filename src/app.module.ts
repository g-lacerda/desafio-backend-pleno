import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AcceptLanguageResolver, HeaderResolver, I18nModule, QueryResolver } from 'nestjs-i18n';
import * as path from 'path';
import { envValidationSchema } from './shared/config/env.validation';
import { buildLoggerOptions } from './shared/logger/logger.config';
import { ApiKeyAuthGuard } from './shared/auth/api-key.guard';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { UserLanguageResolver } from './shared/i18n/user-language.resolver';
import { MetricsModule } from './shared/metrics/metrics.module';
import { NotFoundModule } from './shared/not-found/not-found.module';
import { PrismaModule } from './shared/database/prisma.module';
import { IdempotencyModule } from './shared/idempotency/idempotency.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { EnrichmentModule } from './modules/enrichment/enrichment.module';
import { HealthModule } from './modules/health/health.module';
import { OrdersModule } from './modules/orders/orders.module';
import { QueueModule } from './modules/queue/queue.module';
import { UsersModule } from './modules/users/users.module';

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
      // Cascata: idioma do usuário autenticado → query (?lang=) → header X-Lang →
      // header Accept-Language → fallbackLanguage.
      resolvers: [
        UserLanguageResolver,
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
        prefix: config.get<string>('BULL_PREFIX') ?? 'bull',
      }),
    }),
    PrismaModule,
    IdempotencyModule,
    MetricsModule,
    UsersModule,
    AuthModule,
    HealthModule,
    OrdersModule,
    EnrichmentModule,
    QueueModule,
    AdminModule,
    // NotFoundModule precisa ser o ÚLTIMO import: seu wildcard `@All('*path')`
    // captura qualquer rota não atendida pelos módulos anteriores.
    NotFoundModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      // Guard global: todas as rotas exigem API key, exceto as marcadas com `@Public()`
      // ou listadas no whitelist do guard (/metrics, /docs).
      provide: APP_GUARD,
      useClass: ApiKeyAuthGuard,
    },
  ],
})
export class AppModule {}
