import { ExecutionContext, Injectable } from '@nestjs/common';
import { I18nResolver } from 'nestjs-i18n';
import { User } from '@prisma/client';
import { REQUEST_USER_KEY } from '@/shared/auth/current-user.decorator';

const LANGUAGE_DB_TO_TAG: Record<string, string> = {
  PT_BR: 'pt-BR',
  EN: 'en',
  ES: 'es',
};

/**
 * Resolver de idioma específico do projeto: lê o `preferredLanguage` do usuário
 * autenticado anexado pelo `ApiKeyAuthGuard` e converte do enum Prisma para a
 * tag IETF (`PT_BR` → `pt-BR`).
 *
 * Cascata completa (gerenciada pela ordem de `resolvers` no I18nModule):
 *   1. Este resolver (req.user.preferredLanguage)
 *   2. AcceptLanguageResolver (header Accept-Language)
 *   3. fallbackLanguage (DEFAULT_LANGUAGE / 'en')
 */
@Injectable()
export class UserLanguageResolver implements I18nResolver {
  resolve(context: ExecutionContext): string | undefined {
    if (context.getType() !== 'http') return undefined;

    const req = context.switchToHttp().getRequest<{ [REQUEST_USER_KEY]?: User }>();
    const user = req[REQUEST_USER_KEY];
    if (!user) return undefined;

    return LANGUAGE_DB_TO_TAG[user.preferredLanguage] ?? undefined;
  }
}
