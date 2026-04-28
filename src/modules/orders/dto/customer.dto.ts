import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { i18nValidationMessage as i18n } from 'nestjs-i18n';

export class CustomerDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsString({ message: i18n('validation.isString') })
  @IsNotEmpty({ message: i18n('validation.isNotEmpty') })
  @IsEmail({}, { message: i18n('validation.isEmail') })
  @MaxLength(255, { message: i18n('validation.maxLength') })
  email!: string;

  @ApiProperty({ example: 'Ana Silva' })
  @IsString({ message: i18n('validation.isString') })
  @IsNotEmpty({ message: i18n('validation.isNotEmpty') })
  @MinLength(1, { message: i18n('validation.minLength') })
  @MaxLength(255, { message: i18n('validation.maxLength') })
  name!: string;
}
