import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { i18nValidationMessage as i18n } from 'nestjs-i18n';

export class LoginDto {
  @ApiProperty({ example: 'demo@inbazz.com' })
  @IsString({ message: i18n('validation.isString') })
  @IsNotEmpty({ message: i18n('validation.isNotEmpty') })
  @IsEmail({}, { message: i18n('validation.isEmail') })
  email!: string;

  @ApiProperty({ example: 'p@ssword123' })
  @IsString({ message: i18n('validation.isString') })
  @IsNotEmpty({ message: i18n('validation.isNotEmpty') })
  password!: string;
}
