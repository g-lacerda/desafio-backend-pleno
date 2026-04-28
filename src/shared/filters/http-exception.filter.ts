import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nContext, I18nService } from 'nestjs-i18n';

interface TranslatableMessage {
  key: string;
  args?: Record<string, unknown>;
}

const DEFAULT_HTTP_MESSAGES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too Many Requests',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
};

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly i18n: I18nService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const lang = I18nContext.current()?.lang;

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorName = this.resolveErrorName(status);

    const message = this.resolveMessage(exception, lang, status);

    if (status >= 500) {
      this.logger.error(
        {
          path: request.url,
          method: request.method,
          status,
          err: exception instanceof Error ? exception.stack : String(exception),
        },
        'Unhandled exception',
      );
    }

    const body: ErrorResponseBody = {
      statusCode: status,
      message,
      error: errorName,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }

  private resolveMessage(
    exception: unknown,
    lang: string | undefined,
    status: number,
  ): string | string[] {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === 'string') {
        if (DEFAULT_HTTP_MESSAGES[status] === response) {
          return this.translateFallback(status, lang);
        }
        return this.translate(response, undefined, lang);
      }

      if (typeof response === 'object' && response !== null) {
        const r = response as Record<string, unknown>;

        if (typeof r.key === 'string') {
          return this.translate(r.key, r.args as Record<string, unknown>, lang);
        }

        if (Array.isArray(r.message)) {
          return r.message.map((m) =>
            typeof m === 'string' ? this.translate(m, undefined, lang) : String(m),
          );
        }

        if (typeof r.message === 'string') {
          // Quando a exception NestJS é instanciada sem mensagem custom (ex.: `new NotFoundException()`),
          // a `message` recai no reason phrase HTTP padrão (ex.: 'Not Found'). Traduzir via fallback do status.
          if (DEFAULT_HTTP_MESSAGES[status] === r.message) {
            return this.translateFallback(status, lang);
          }
          return this.translate(r.message, r.args as Record<string, unknown>, lang);
        }
      }
    }

    return this.translateFallback(status, lang);
  }

  private translate(
    key: string,
    args: Record<string, unknown> | undefined,
    lang: string | undefined,
  ): string {
    if (!this.looksLikeI18nKey(key)) {
      return key;
    }

    const translated = this.i18n.translate<string>(key, { lang, args });

    if (typeof translated === 'string' && translated !== key) {
      return translated;
    }

    return key;
  }

  private translateFallback(status: number, lang: string | undefined): string {
    const fallbackKey =
      status === HttpStatus.NOT_FOUND
        ? 'errors.common.notFound'
        : status === HttpStatus.BAD_REQUEST
          ? 'errors.common.badRequest'
          : 'errors.common.internalServerError';

    return this.translate(fallbackKey, undefined, lang);
  }

  private looksLikeI18nKey(value: string): boolean {
    return /^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)+$/.test(value);
  }

  private resolveErrorName(status: number): string {
    return HttpStatus[status] ?? 'Error';
  }

  static buildException(key: string, args?: Record<string, unknown>): TranslatableMessage {
    return { key, args };
  }
}
