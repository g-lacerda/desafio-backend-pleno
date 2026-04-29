import { ApiProperty } from '@nestjs/swagger';
import { Language } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty({ example: '7e9b6a45-0e6f-4f1c-9c1d-3a4f2e8e6a47' })
  id!: string;

  @ApiProperty({ example: 'demo@inbazz.com' })
  email!: string;

  @ApiProperty({ example: 'Demo User' })
  name!: string;

  @ApiProperty({ enum: Language })
  preferredLanguage!: Language;

  @ApiProperty({ example: '2026-04-28T20:31:42.123Z' })
  created_at!: string;
}

export class CreatedUserResponseDto extends UserResponseDto {
  @ApiProperty({
    example: 'sk_live_abc123def456...',
    description:
      'API key gerada. **Mostrada APENAS NESTA RESPOSTA** — guarde-a com segurança, ' +
      'pois o servidor armazena somente o hash SHA-256.',
  })
  api_key!: string;
}
