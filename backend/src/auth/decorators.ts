import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Papel } from '@prisma/client';

export const Papeis = (...papeis: Papel[]) => SetMetadata('papeis', papeis);

export type UsuarioAutenticado = { id: string; papel: Papel };

export const UsuarioAtual = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UsuarioAutenticado =>
    ctx.switchToHttp().getRequest().usuario,
);