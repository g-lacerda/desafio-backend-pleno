import { ExecutionContext } from '@nestjs/common';
import { Language, User } from '@prisma/client';
import { REQUEST_USER_KEY } from '@/shared/auth/current-user.decorator';
import { UserLanguageResolver } from './user-language.resolver';

describe('UserLanguageResolver', () => {
  const resolver = new UserLanguageResolver();

  const buildContext = (req: { [REQUEST_USER_KEY]?: User }, type = 'http'): ExecutionContext =>
    ({
      getType: () => type,
      switchToHttp: () => ({
        getRequest: <T = unknown>(): T => req as unknown as T,
      }),
    }) as unknown as ExecutionContext;

  const buildUser = (lang: Language): User => ({
    id: 'u',
    email: 'a@b.com',
    name: 'A',
    preferredLanguage: lang,
    apiKeyHash: 'h',
    passwordHash: 'p',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it('retorna pt-BR quando usuário tem preferredLanguage=PT_BR', () => {
    const ctx = buildContext({ [REQUEST_USER_KEY]: buildUser(Language.PT_BR) });
    expect(resolver.resolve(ctx)).toBe('pt-BR');
  });

  it('retorna en quando usuário tem preferredLanguage=EN', () => {
    const ctx = buildContext({ [REQUEST_USER_KEY]: buildUser(Language.EN) });
    expect(resolver.resolve(ctx)).toBe('en');
  });

  it('retorna es quando usuário tem preferredLanguage=ES', () => {
    const ctx = buildContext({ [REQUEST_USER_KEY]: buildUser(Language.ES) });
    expect(resolver.resolve(ctx)).toBe('es');
  });

  it('retorna undefined quando não há usuário (fluxo cai no próximo resolver da cascata)', () => {
    const ctx = buildContext({});
    expect(resolver.resolve(ctx)).toBeUndefined();
  });

  it('retorna undefined quando context não é http', () => {
    const ctx = buildContext({ [REQUEST_USER_KEY]: buildUser(Language.PT_BR) }, 'rpc');
    expect(resolver.resolve(ctx)).toBeUndefined();
  });
});
