import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Papel } from '@prisma/client';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const [tipo, token] = (req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw new UnauthorizedException();

    try {
      const { sub, papel } = await this.jwt.verifyAsync(token);
      req.usuario = { id: sub, papel };
    } catch {
      throw new UnauthorizedException();
    }

    const exigidos = this.reflector.getAllAndOverride<Papel[] | undefined>('papeis', [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (exigidos && !exigidos.includes(req.usuario.papel)) throw new ForbiddenException();
    return true;
  }
}