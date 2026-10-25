import { Controller, Get, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { publicar, verificarCadeia } from './cadeia';

@Controller('auditoria')
export class AuditoriaController {
  constructor(private prisma: PrismaService) {}

  // Público: sem login, e só com dados anonimizados.
  @Get(':loteId')
  async auditar(@Param('loteId', ParseUUIDPipe) loteId: string) {
    const lote = await this.prisma.lote.findUnique({
      where: { id: loteId },
      select: {
        id: true,
        titulo: true,
        valorAtual: true,
        liderId: true,
        lances: { orderBy: { sequencia: 'asc' } },
      },
    });
    if (!lote) throw new NotFoundException('Lote não encontrado');

    const resultado = verificarCadeia(lote.lances, lote);
    return {
      loteId: lote.id,
      titulo: lote.titulo,
      selo: resultado.integro ? 'INTEGRO' : 'ADULTERADO',
      primeiroInvalido: resultado.primeiroInvalido,
      problema: resultado.problema,
      totalLances: lote.lances.length,
      lances: publicar(lote.lances),
    };
  }
}