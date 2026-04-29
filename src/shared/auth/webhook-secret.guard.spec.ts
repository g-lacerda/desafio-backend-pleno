import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookSecretGuard } from './webhook-secret.guard';
import { InvalidWebhookSecretException } from './exceptions/invalid-webhook-secret.exception';
import { MissingWebhookSecretException } from './exceptions/missing-webhook-secret.exception';

describe('WebhookSecretGuard', () => {
  let guard: WebhookSecretGuard;
  const SECRET = 'super-webhook-secret-1234';
  const config = { getOrThrow: () => SECRET } as unknown as ConfigService;

  const buildContext = (headers: Record<string, string> = {}): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: <T = unknown>(): T => ({ headers } as unknown as T),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    guard = new WebhookSecretGuard(config);
  });

  it('lança MissingWebhookSecretException sem header', () => {
    expect(() => guard.canActivate(buildContext({}))).toThrow(MissingWebhookSecretException);
  });

  it('lança InvalidWebhookSecretException com secret errado', () => {
    expect(() =>
      guard.canActivate(buildContext({ 'x-webhook-secret': 'wrong' })),
    ).toThrow(InvalidWebhookSecretException);
  });

  it('aceita header X-Webhook-Secret correto', () => {
    expect(guard.canActivate(buildContext({ 'x-webhook-secret': SECRET }))).toBe(true);
  });

  it('aceita Authorization: Bearer com o secret', () => {
    expect(
      guard.canActivate(buildContext({ authorization: `Bearer ${SECRET}` })),
    ).toBe(true);
  });

  it('Authorization Bearer com secret errado → 401', () => {
    expect(() =>
      guard.canActivate(buildContext({ authorization: 'Bearer wrong-secret' })),
    ).toThrow(InvalidWebhookSecretException);
  });

  it('X-Webhook-Secret tem precedência sobre Authorization', () => {
    expect(
      guard.canActivate(
        buildContext({ 'x-webhook-secret': SECRET, authorization: 'Bearer wrong' }),
      ),
    ).toBe(true);
  });
});
