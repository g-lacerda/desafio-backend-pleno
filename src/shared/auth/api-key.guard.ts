import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { UsersService } from '@/modules/users/users.service';
import { REQUEST_USER_KEY } from './current-user.decorator';
import { IS_PUBLIC_KEY } from './public.decorator';
import { InvalidApiKeyException } from './exceptions/invalid-api-key.exception';
import { MissingApiKeyException } from './exceptions/missing-api-key.exception';

const BEARER_PREFIX = /^Bearer\s+/i;

/**
 * Paths expostos por bibliotecas externas que não passam pelo pipeline normal
 * de controllers do NestJS:
 * - `/metrics`: PrometheusController (público para scrapers).
 * - `/docs`: Swagger UI montada via `app.use()`.
 *
 * Bull Board (`/admin/queues`) NÃO está aqui — é protegido por Express middleware
 * separado (registrado em `app.setup.ts → setupAdminAuth`) que valida `ADMIN_API_KEY`.
 */
const PUBLIC_PATH_PREFIXES = ['/metrics', '/docs'];

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublic(context)) return true;

    const req = context.switchToHttp().getRequest<Request>();
    if (this.isWhitelistedPath(req.url)) return true;

    const rawKey = this.extractKey(req);
    if (!rawKey) throw new MissingApiKeyException();

    const user = await this.users.findByApiKey(rawKey);
    if (!user) throw new InvalidApiKeyException();

    (req as Request & { [REQUEST_USER_KEY]: typeof user })[REQUEST_USER_KEY] = user;
    return true;
  }

  private isPublic(context: ExecutionContext): boolean {
    return Boolean(
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]),
    );
  }

  private isWhitelistedPath(url: string): boolean {
    return PUBLIC_PATH_PREFIXES.some((prefix) => url.startsWith(prefix));
  }

  private extractKey(req: Request): string | null {
    const authorization = req.headers.authorization;
    if (authorization && BEARER_PREFIX.test(authorization)) {
      return authorization.replace(BEARER_PREFIX, '').trim() || null;
    }
    const headerKey = req.headers['x-api-key'];
    if (typeof headerKey === 'string' && headerKey.length > 0) return headerKey;
    return null;
  }
}
