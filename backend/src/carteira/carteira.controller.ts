import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Carteira } from '@prisma/client';
import { IsInt, Max, Min } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { Papeis, UsuarioAtual, type UsuarioAutenticado } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';

class DepositoDto {
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  valor!: number;
}

const resumo = (c: Carteira) => ({
  saldoTotal: c.saldoTotal,
  saldoComprometido: c.saldoComprometido,
  saldoDisponivel: c.saldoTotal - c.saldoComprometido,
});

@Controller('carteira')
@UseGuards(AuthGuard)
export class CarteiraController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async saldo(@UsuarioAtual() usuario: UsuarioAutenticado) {
    const carteira = await this.prisma.carteira.findUniqueOrThrow({
      where: { usuarioId: usuario.id },
    });
    return resumo(carteira);
  }

  @Post('depositos')
  @Papeis('LICITANTE')
  async depositar(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() { valor }: DepositoDto) {
    const carteira = await this.prisma.carteira.update({
      where: { usuarioId: usuario.id },
      data: { saldoTotal: { increment: BigInt(valor) } },
    });
    return resumo(carteira);
  }
}