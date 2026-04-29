import { ApiProperty } from '@nestjs/swagger';
import { Language } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { i18nValidationMessage as i18n } from 'nestjs-i18n';

export class CreateUserDto {
  @ApiProperty({ example: 'demo@inbazz.com' })
  @IsString({ message: i18n('validation.isString') })
  @IsNotEmpty({ message: i18n('validation.isNotEmpty') })
  @IsEmail({}, { message: i18n('validation.isEmail') })
  @MaxLength(255, { message: i18n('validation.maxLength') })
  email!: string;

  @ApiProperty({ example: 'Demo User' })
  @IsString({ message: i18n('validation.isString') })
  @IsNotEmpty({ message: i18n('validation.isNotEmpty') })
  @MaxLength(255, { message: i18n('validation.maxLength') })
  name!: string;

  @ApiProperty({
    example: 'p@ssword123',
    minLength: 8,
    description:
      'Senha (mín. 8 caracteres, máx. 72). Armazenada como bcrypt hash. ' +
      'Usada apenas para `POST /auth/login` rotacionar a API key se for perdida.',
  })
  @IsString({ message: i18n('validation.isString') })
  @IsNotEmpty({ message: i18n('validation.isNotEmpty') })
  @MinLength(8, { message: i18n('validation.minLength') })
  @MaxLength(72, { message: i18n('validation.maxLength') })
  password!: string;

  @ApiProperty({ enum: Language, example: Language.PT_BR })
  @IsEnum(Language, { message: i18n('validation.isEnum') })
  preferredLanguage!: Language;
}
