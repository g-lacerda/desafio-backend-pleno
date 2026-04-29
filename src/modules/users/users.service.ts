import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { generateApiKey, hashApiKey } from '@/shared/auth/api-key.utils';
import { CreateUserDto } from './dto/create-user.dto';
import { CreatedUserResponseDto } from './dto/user-response.dto';
import { EmailAlreadyExistsException } from './exceptions/email-already-exists.exception';
import { UserMapper } from './mappers/user.mapper';
import { UsersRepository } from './users.repository';

const PRISMA_UNIQUE_VIOLATION = 'P2002';
const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(private readonly repository: UsersRepository) {}

  async create(dto: CreateUserDto): Promise<CreatedUserResponseDto> {
    const { plain, hash: apiKeyHash } = generateApiKey();
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    try {
      const user = await this.repository.create({
        email: dto.email,
        name: dto.name,
        preferredLanguage: dto.preferredLanguage,
        apiKeyHash,
        passwordHash,
      });
      return UserMapper.toCreatedResponse(user, plain);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_UNIQUE_VIOLATION
      ) {
        throw new EmailAlreadyExistsException(dto.email);
      }
      throw error;
    }
  }

  /**
   * Valida `(email, password)`. Retorna o usuário em caso de sucesso ou `null`
   * quando email não existe OU senha não bate (mensagem genérica intencional
   * para evitar enumeração de emails válidos).
   */
  async verifyCredentials(email: string, password: string): Promise<User | null> {
    const user = await this.repository.findByEmail(email);
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    return ok ? user : null;
  }

  /**
   * Gera nova API key, invalidando a anterior. Devolve o plain — só aparece UMA vez.
   */
  async rotateApiKey(userId: string): Promise<string> {
    const { plain, hash } = generateApiKey();
    await this.repository.updateApiKeyHash(userId, hash);
    return plain;
  }

  /**
   * Hasheia a key recebida e procura o usuário associado. Retorna `null`
   * quando a chave não corresponde a nenhum usuário ativo.
   */
  findByApiKey(apiKey: string): Promise<User | null> {
    return this.repository.findByApiKeyHash(hashApiKey(apiKey));
  }
}
