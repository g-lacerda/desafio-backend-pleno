import { Injectable, Logger } from '@nestjs/common';
import { UsersService } from '@/modules/users/users.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { InvalidCredentialsException } from './exceptions/invalid-credentials.exception';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly users: UsersService) {}

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.users.verifyCredentials(dto.email, dto.password);
    if (!user) {
      this.logger.warn({ email: dto.email }, 'Login failed: invalid credentials');
      throw new InvalidCredentialsException();
    }

    const newApiKey = await this.users.rotateApiKey(user.id);

    this.logger.log({ userId: user.id, email: user.email }, 'Login successful, API key rotated');

    return {
      id: user.id,
      email: user.email,
      preferredLanguage: user.preferredLanguage,
      api_key: newApiKey,
    };
  }
}
