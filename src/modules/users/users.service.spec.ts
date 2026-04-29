import { Language, Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { hashApiKey } from '@/shared/auth/api-key.utils';
import { EmailAlreadyExistsException } from './exceptions/email-already-exists.exception';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<UsersRepository>;

  const fakeUser: User = {
    id: 'u-1',
    email: 'demo@inbazz.com',
    name: 'Demo',
    preferredLanguage: Language.PT_BR,
    apiKeyHash: 'hash',
    passwordHash: '$2b$10$fake',
    createdAt: new Date('2026-04-28T00:00:00.000Z'),
    updatedAt: new Date('2026-04-28T00:00:00.000Z'),
  };

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findByApiKeyHash: jest.fn(),
      findByEmail: jest.fn(),
      updateApiKeyHash: jest.fn(),
    } as unknown as jest.Mocked<UsersRepository>;
    service = new UsersService(repository);
  });

  describe('create', () => {
    it('gera API key, hasheia a senha (bcrypt), persiste hashes e devolve plain uma única vez', async () => {
      repository.create.mockImplementation((data) =>
        Promise.resolve({ ...fakeUser, apiKeyHash: data.apiKeyHash, passwordHash: data.passwordHash }),
      );

      const result = await service.create({
        email: 'demo@inbazz.com',
        name: 'Demo',
        password: 'plaintext-pass',
        preferredLanguage: Language.PT_BR,
      });

      expect(result.api_key).toMatch(/^sk_live_[A-Za-z0-9_-]+$/);
      const persisted = repository.create.mock.calls[0][0];
      expect(hashApiKey(result.api_key)).toBe(persisted.apiKeyHash);
      expect(persisted.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(persisted.passwordHash).not.toBe('plaintext-pass');
      expect(await bcrypt.compare('plaintext-pass', persisted.passwordHash)).toBe(true);
      expect(result).not.toHaveProperty('apiKeyHash');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('lança EmailAlreadyExistsException em violação de unique', async () => {
      const error = new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: 't',
      });
      repository.create.mockRejectedValue(error);

      await expect(
        service.create({
          email: 'dup@e.com',
          name: 'X',
          password: 'whatever-strong',
          preferredLanguage: Language.EN,
        }),
      ).rejects.toBeInstanceOf(EmailAlreadyExistsException);
    });

    it('relança outros erros inesperados', async () => {
      repository.create.mockRejectedValue(new Error('boom'));
      await expect(
        service.create({
          email: 'x@e.com',
          name: 'X',
          password: 'whatever-strong',
          preferredLanguage: Language.EN,
        }),
      ).rejects.toThrow('boom');
    });
  });

  describe('verifyCredentials', () => {
    it('retorna o user quando email + senha conferem', async () => {
      const realHash = await bcrypt.hash('correct-pass', 10);
      repository.findByEmail.mockResolvedValue({ ...fakeUser, passwordHash: realHash });

      const result = await service.verifyCredentials('demo@inbazz.com', 'correct-pass');
      expect(result?.id).toBe(fakeUser.id);
    });

    it('retorna null quando senha não bate', async () => {
      const realHash = await bcrypt.hash('correct-pass', 10);
      repository.findByEmail.mockResolvedValue({ ...fakeUser, passwordHash: realHash });

      const result = await service.verifyCredentials('demo@inbazz.com', 'wrong-pass');
      expect(result).toBeNull();
    });

    it('retorna null quando email não existe (mensagem genérica intencional)', async () => {
      repository.findByEmail.mockResolvedValue(null);
      const result = await service.verifyCredentials('absent@inbazz.com', 'whatever');
      expect(result).toBeNull();
    });
  });

  describe('rotateApiKey', () => {
    it('gera nova chave, atualiza hash no banco e retorna plain', async () => {
      repository.updateApiKeyHash.mockResolvedValue(fakeUser);

      const newKey = await service.rotateApiKey('u-1');

      expect(newKey).toMatch(/^sk_live_[A-Za-z0-9_-]+$/);
      expect(repository.updateApiKeyHash).toHaveBeenCalledWith('u-1', hashApiKey(newKey));
    });
  });

  describe('findByApiKey', () => {
    it('hasheia a key e busca pelo repositório', async () => {
      repository.findByApiKeyHash.mockResolvedValue(fakeUser);

      const result = await service.findByApiKey('sk_live_abc');

      expect(repository.findByApiKeyHash).toHaveBeenCalledWith(hashApiKey('sk_live_abc'));
      expect(result).toBe(fakeUser);
    });

    it('devolve null quando não encontra', async () => {
      repository.findByApiKeyHash.mockResolvedValue(null);
      const result = await service.findByApiKey('sk_live_invalid');
      expect(result).toBeNull();
    });
  });
});
