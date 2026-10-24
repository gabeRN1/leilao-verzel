import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Usuario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegistrarDto } from './auth.dto';
import { conferirSenha, hashSenha } from './senha';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async registrar({ nome, email, senha, papel }: RegistrarDto) {
    try {
      const usuario = await this.prisma.usuario.create({
        data: {
          nome,
          email,
          papel,
          senhaHash: await hashSenha(senha),
          carteira: { create: {} },
        },
      });
      return this.sessao(usuario);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('E-mail já cadastrado');
      }
      throw e;
    }
  }

  async entrar({ email, senha }: LoginDto) {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    if (!usuario || !(await conferirSenha(senha, usuario.senhaHash))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    return this.sessao(usuario);
  }

  private async sessao({ id, nome, papel }: Usuario) {
    const token = await this.jwt.signAsync({ sub: id, papel });
    return { token, usuario: { id, nome, papel } };
  }
}