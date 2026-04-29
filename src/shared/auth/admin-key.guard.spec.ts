import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminKeyGuard } from './admin-key.guard';
import { InvalidAdminKeyException } from './exceptions/invalid-admin-key.exception';
import { MissingAdminKeyException } from './exceptions/missing-admin-key.exception';

describe('AdminKeyGuard', () => {
  let guard: AdminKeyGuard;
  const ADMIN_KEY = 'super-admin-secret-1234';
  const config = { getOrThrow: () => ADMIN_KEY } as unknown as ConfigService;

  const buildContext = (headers: Record<string, string> = {}): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: <T = unknown>(): T => ({ headers } as unknown as T),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    guard = new AdminKeyGuard(config);
  });

  it('lança MissingAdminKeyException sem header', () => {
    expect(() => guard.canActivate(buildContext({}))).toThrow(MissingAdminKeyException);
  });

  it('lança InvalidAdminKeyException com chave errada', () => {
    expect(() =>
      guard.canActivate(buildContext({ 'x-admin-key': 'wrong' })),
    ).toThrow(InvalidAdminKeyException);
  });

  it('aceita header X-Admin-Key correto', () => {
    expect(guard.canActivate(buildContext({ 'x-admin-key': ADMIN_KEY }))).toBe(true);
  });

  it('aceita Authorization: Bearer com a chave admin', () => {
    expect(
      guard.canActivate(buildContext({ authorization: `Bearer ${ADMIN_KEY}` })),
    ).toBe(true);
  });

  it('Authorization Bearer com chave errada → 401', () => {
    expect(() =>
      guard.canActivate(buildContext({ authorization: 'Bearer wrong-key' })),
    ).toThrow(InvalidAdminKeyException);
  });

  it('X-Admin-Key tem precedência sobre Authorization', () => {
    expect(
      guard.canActivate(
        buildContext({ 'x-admin-key': ADMIN_KEY, authorization: 'Bearer wrong' }),
      ),
    ).toBe(true);
  });
});
