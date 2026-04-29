import { Language, User } from '@prisma/client';
import { UsersService } from '@/modules/users/users.service';
import { AuthService } from './auth.service';
import { InvalidCredentialsException } from './exceptions/invalid-credentials.exception';

describe('AuthService', () => {
  let service: AuthService;
  let users: jest.Mocked<UsersService>;

  const fakeUser: User = {
    id: 'u-1',
    email: 'demo@inbazz.com',
    name: 'Demo',
    preferredLanguage: Language.PT_BR,
    apiKeyHash: 'old-hash',
    passwordHash: 'pw-hash',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    users = {
      verifyCredentials: jest.fn(),
      rotateApiKey: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;
    service = new AuthService(users);
  });

  it('autentica e rotaciona a API key em caso de sucesso', async () => {
    users.verifyCredentials.mockResolvedValue(fakeUser);
    users.rotateApiKey.mockResolvedValue('sk_live_NEW_KEY_xyz');

    const result = await service.login({ email: 'demo@inbazz.com', password: 'pw' });

    expect(users.verifyCredentials).toHaveBeenCalledWith('demo@inbazz.com', 'pw');
    expect(users.rotateApiKey).toHaveBeenCalledWith('u-1');
    expect(result).toEqual({
      id: 'u-1',
      email: 'demo@inbazz.com',
      preferredLanguage: Language.PT_BR,
      api_key: 'sk_live_NEW_KEY_xyz',
    });
  });

  it('lança InvalidCredentialsException quando senha não bate', async () => {
    users.verifyCredentials.mockResolvedValue(null);

    await expect(
      service.login({ email: 'demo@inbazz.com', password: 'wrong' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsException);
    expect(users.rotateApiKey).not.toHaveBeenCalled();
  });

  it('lança InvalidCredentialsException quando email não existe (mensagem genérica)', async () => {
    users.verifyCredentials.mockResolvedValue(null);

    await expect(
      service.login({ email: 'absent@inbazz.com', password: 'whatever' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsException);
  });
});
