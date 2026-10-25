import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { anonimizar } from '../auditoria/anonimo';
import { AuthGuard } from '../auth/auth.guard';
import { Papeis, UsuarioAtual, type UsuarioAutenticado } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';

const resumoDoLote = { lote: { select: { titulo: true, imagemUrl: true } } };

@Controller('arremates')
export class ArrematesController {
  constructor(private prisma: PrismaService) {}

  @Get('meus')
  @UseGuards(AuthGuard)
  @Papeis('LICITANTE')
  async meus(@UsuarioAtual() usuario: UsuarioAutenticado) {
    const arremates = await this.prisma.arremate.findMany({
      where: { vencedorId: usuario.id },
      orderBy: { liquidadoEm: 'desc' },
      include: resumoDoLote,
    });
    return arremates.map(({ id, loteId, valor, liquidadoEm, lote }) => ({
      id,
      loteId,
      valor,
      liquidadoEm,
      titulo: lote.titulo,
      imagemUrl: lote.imagemUrl,
    }));
  }

  @Get('vendas')
  @UseGuards(AuthGuard)
  @Papeis('LEILOEIRO')
  async vendas(@UsuarioAtual() usuario: UsuarioAutenticado) {
    const arremates = await this.prisma.arremate.findMany({
      where: { leiloeiroId: usuario.id },
      orderBy: { liquidadoEm: 'desc' },
      include: resumoDoLote,
    });
    return arremates.map(({ id, loteId, valor, liquidadoEm, vencedorId, lote }) => ({
      id,
      loteId,
      valor,
      liquidadoEm,
      titulo: lote.titulo,
      vencedor: anonimizar(vencedorId),
    }));
  }

  // Público. O id do arremate é um UUID, e o corpo só traz dados anonimizados.
  @Get(':id/comprovante')
  async comprovante(@Param('id', ParseUUIDPipe) id: string) {
    const arremate = await this.prisma.arremate.findUnique({
      where: { id },
      include: {
        lote: {
          include: {
            leiloeiro: { select: { nome: true } },
            lances: { orderBy: { sequencia: 'desc' }, take: 1, select: { sequencia: true, hash: true } },
          },
        },
      },
    });
    if (!arremate) throw new NotFoundException('Comprovante não encontrado');

    const { lote } = arremate;
    const ultimo = lote.lances[0];
    return {
      id: arremate.id,
      liquidadoEm: arremate.liquidadoEm,
      valor: arremate.valor,
      vencedor: anonimizar(arremate.vencedorId),
      leiloeiro: lote.leiloeiro.nome,
      lote: {
        id: lote.id,
        titulo: lote.titulo,
        imagemUrl: lote.imagemUrl,
        origemId: lote.origemId,
        atributos: lote.atributos,
      },
      totalLances: ultimo.sequencia,
      // Amarra o comprovante à cadeia: a auditoria da Fase 6 recalcula até este hash.
      hashFinal: ultimo.hash,
    };
  }
}