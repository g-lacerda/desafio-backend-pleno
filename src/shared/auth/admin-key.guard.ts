import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { InvalidApiKeyException } from './exceptions/invalid-api-key.exception';
import { MissingApiKeyException } from './exceptions/missing-api-key.exception';

const BEARER_PREFIX = /^Bearer\s+/i;

/**
 * Guard pra rotas administrativas (`POST /users`, Bull Board). Valida a chave
 * contra a env `ADMIN_API_KEY`. Aceita header `X-Admin-Key` ou `Authorization:
 * Bearer <admin-key>`. Diferente do `ApiKeyAuthGuard` (per-user), esta chave
 * é compartilhada — usada pra tarefas de bootstrap/operação.
 */
@Injectable()
export class AdminKeyGuard implements CanActivate {
  private readonly adminKey: string;

  constructor(config: ConfigService) {
    this.adminKey = config.getOrThrow<string>('ADMIN_API_KEY');
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const provided = this.extractKey(req);
    if (!provided) throw new MissingApiKeyException();
    if (provided !== this.adminKey) throw new InvalidApiKeyException();
    return true;
  }

  private extractKey(req: Request): string | null {
    const headerKey = req.headers['x-admin-key'];
    if (typeof headerKey === 'string' && headerKey.length > 0) return headerKey;
    const authorization = req.headers.authorization;
    if (authorization && BEARER_PREFIX.test(authorization)) {
      return authorization.replace(BEARER_PREFIX, '').trim() || null;
    }
    return null;
  }
}
