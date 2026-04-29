import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Language, User } from '@prisma/client';
import { UsersService } from '@/modules/users/users.service';
import { ApiKeyAuthGuard } from './api-key.guard';
import { REQUEST_USER_KEY } from './current-user.decorator';
import { InvalidApiKeyException } from './exceptions/invalid-api-key.exception';
import { MissingApiKeyException } from './exceptions/missing-api-key.exception';

describe('ApiKeyAuthGuard', () => {
  let guard: ApiKeyAuthGuard;
  let users: jest.Mocked<UsersService>;
  let reflector: Reflector;

  const buildContext = (req: {
    headers?: Record<string, string>;
    url?: string;
  }): ExecutionContext => {
    const r = { headers: req.headers ?? {}, url: req.url ?? '/orders' };
    return {
      switchToHttp: () => ({
        getRequest: <T = unknown>(): T => r as unknown as T,
        getResponse: <T = unknown>(): T => ({}) as unknown as T,
      }),
      getHandler: () => () => undefined,
      getClass: () => class C {},
    } as unknown as ExecutionContext;
  };

  const fakeUser: User = {
    id: 'u-1',
    email: 'u@e.com',
    name: 'U',
    preferredLanguage: Language.EN,
    apiKeyHash: 'hash',
    passwordHash: 'hash',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    users = { findByApiKey: jest.fn() } as unknown as jest.Mocked<UsersService>;
    reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    guard = new ApiKeyAuthGuard(reflector, users);
  });

  it('libera quando rota é marcada com @Public()', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const result = await guard.canActivate(buildContext({}));
    expect(result).toBe(true);
    expect(users.findByApiKey).not.toHaveBeenCalled();
  });

  it('libera caminhos whitelisted (/metrics, /docs)', async () => {
    expect(await guard.canActivate(buildContext({ url: '/metrics' }))).toBe(true);
    expect(await guard.canActivate(buildContext({ url: '/docs/openapi' }))).toBe(true);
  });

  it('lança MissingApiKeyException sem header', async () => {
    await expect(guard.canActivate(buildContext({}))).rejects.toBeInstanceOf(
      MissingApiKeyException,
    );
  });

  it('lança InvalidApiKeyException quando chave não corresponde a nenhum usuário', async () => {
    users.findByApiKey.mockResolvedValue(null);
    await expect(
      guard.canActivate(buildContext({ headers: { 'x-api-key': 'sk_live_xxx' } })),
    ).rejects.toBeInstanceOf(InvalidApiKeyException);
  });

  it('aceita header X-API-Key e anexa user ao request', async () => {
    users.findByApiKey.mockResolvedValue(fakeUser);
    const req = { headers: { 'x-api-key': 'sk_live_valid' } };
    const ctx = buildContext(req);

    expect(await guard.canActivate(ctx)).toBe(true);
    expect(users.findByApiKey).toHaveBeenCalledWith('sk_live_valid');
    const r = ctx.switchToHttp().getRequest<{ [REQUEST_USER_KEY]?: User }>();
    expect(r[REQUEST_USER_KEY]).toBe(fakeUser);
  });

  it('aceita header Authorization: Bearer <key>', async () => {
    users.findByApiKey.mockResolvedValue(fakeUser);
    const ctx = buildContext({ headers: { authorization: 'Bearer sk_live_bearer' } });

    await guard.canActivate(ctx);
    expect(users.findByApiKey).toHaveBeenCalledWith('sk_live_bearer');
  });

  it('Authorization tem prioridade sobre X-API-Key', async () => {
    users.findByApiKey.mockResolvedValue(fakeUser);
    await guard.canActivate(
      buildContext({
        headers: { authorization: 'Bearer from-bearer', 'x-api-key': 'from-x-api' },
      }),
    );
    expect(users.findByApiKey).toHaveBeenCalledWith('from-bearer');
  });
});
