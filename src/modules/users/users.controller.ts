import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminKeyGuard } from '@/shared/auth/admin-key.guard';
import { Public } from '@/shared/auth/public.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { CreatedUserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /**
   * `@Public()` desativa o `ApiKeyAuthGuard` global (que valida user keys).
   * `@UseGuards(AdminKeyGuard)` aplica a auth admin no lugar — provisionar
   * usuários é uma operação administrativa, não pode ser feita por qualquer
   * user autenticado.
   */
  @Public()
  @UseGuards(AdminKeyGuard)
  @ApiSecurity('X-Admin-Key')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Cria um novo usuário e gera uma API key (admin)',
    description:
      'Provisiona um novo usuário. **Requer a chave admin** via `X-Admin-Key` ou `Authorization: Bearer <ADMIN_API_KEY>`. ' +
      'A API key do usuário é retornada **uma única vez** no response — o servidor armazena apenas o hash SHA-256.',
  })
  @ApiCreatedResponse({ type: CreatedUserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Admin key ausente ou inválida.' })
  @ApiConflictResponse({ description: 'Email já cadastrado.' })
  create(@Body() dto: CreateUserDto): Promise<CreatedUserResponseDto> {
    return this.users.create(dto);
  }
}
