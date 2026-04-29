import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { InvalidWebhookSecretException } from './exceptions/invalid-webhook-secret.exception';
import { MissingWebhookSecretException } from './exceptions/missing-webhook-secret.exception';

const BEARER_PREFIX = /^Bearer\s+/i;

/**
 * Guard pra POST /webhooks/orders. Valida o segredo compartilhado contra
 * a env `WEBHOOK_SECRET`. Aceita header `X-Webhook-Secret` ou
 * `Authorization: Bearer <webhook-secret>`. Diferente do `ApiKeyAuthGuard`
 * (per-user), este segredo é compartilhado com sistemas externos que
 * postam webhooks.
 */
@Injectable()
export class WebhookSecretGuard implements CanActivate {
  private readonly secret: string;

  constructor(config: ConfigService) {
    this.secret = config.getOrThrow<string>('WEBHOOK_SECRET');
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const provided = this.extractSecret(req);
    if (!provided) throw new MissingWebhookSecretException();
    if (provided !== this.secret) throw new InvalidWebhookSecretException();
    return true;
  }

  private extractSecret(req: Request): string | null {
    const headerKey = req.headers['x-webhook-secret'];
    if (typeof headerKey === 'string' && headerKey.length > 0) return headerKey;
    const authorization = req.headers.authorization;
    if (authorization && BEARER_PREFIX.test(authorization)) {
      return authorization.replace(BEARER_PREFIX, '').trim() || null;
    }
    return null;
  }
}
