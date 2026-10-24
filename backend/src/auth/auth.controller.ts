import { Body, Controller, Post } from '@nestjs/common';
import { LoginDto, RegistrarDto } from './auth.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('registro')
  registrar(@Body() dto: RegistrarDto) {
    return this.auth.registrar(dto);
  }

  @Post('login')
  entrar(@Body() dto: LoginDto) {
    return this.auth.entrar(dto);
  }
}