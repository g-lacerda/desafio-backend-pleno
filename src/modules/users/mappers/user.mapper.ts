import { User } from '@prisma/client';
import { CreatedUserResponseDto, UserResponseDto } from '../dto/user-response.dto';

/**
 * Anti-corruption layer entre `User` (Prisma) e o response da API. Nunca expõe
 * `apiKeyHash`. O `apiKey` plain só aparece em `toCreatedResponse()`, que é
 * usado UMA vez na criação do usuário.
 */
export class UserMapper {
  static toResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      preferredLanguage: user.preferredLanguage,
      created_at: user.createdAt.toISOString(),
    };
  }

  static toCreatedResponse(user: User, apiKey: string): CreatedUserResponseDto {
    return { ...this.toResponse(user), api_key: apiKey };
  }
}
