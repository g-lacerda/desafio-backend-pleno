import { ApiProperty } from '@nestjs/swagger';
import { Language } from '@prisma/client';

export class LoginResponseDto {
  @ApiProperty({ example: '7e9b6a45-0e6f-4f1c-9c1d-3a4f2e8e6a47' })
  id!: string;

  @ApiProperty({ example: 'demo@inbazz.com' })
  email!: string;

  @ApiProperty({ enum: Language })
  preferredLanguage!: Language;

  @ApiProperty({
    example: 'sk_live_NEW_KEY_HERE...',
    description:
      'Nova API key gerada. **A chave anterior do usuário é invalidada imediatamente.** ' +
      'Mostrada apenas nesta resposta — guarde com segurança.',
  })
  api_key!: string;
}
