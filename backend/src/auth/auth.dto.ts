import { Papel } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  senha!: string;
}

export class RegistrarDto extends LoginDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsEnum(Papel)
  papel!: Papel;
}