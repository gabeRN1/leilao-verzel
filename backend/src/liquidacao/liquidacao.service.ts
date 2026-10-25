import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LotesGateway } from '../realtime/lotes.gateway';

type LoteTravado = {
  status: string;
  fimEm: Date;
  valorAtual: bigint | null;
  liderId: string | null;
  leiloeiroId: string;
};

@Injectable()
export class LiquidacaoService implements OnModuleInit, OnModuleDestroy {
  private log = new Logger(LiquidacaoService.name);
  private rodando = false;
  private timer?: NodeJS.Timeout;

  constructor(
    private prisma: PrismaService,
    private gateway: LotesGateway,
  ) {}

  // Nos testes a varredura é chamada à mão; no timer ela correria em paralelo com as asserções.
  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.varrer(), 1000);
  }
  onModuleDestroy() {
    clearInterval(this.timer);
  }

  
  async varrer() {
    if (this.rodando) return;
    this.rodando = true;
    try {
      const vencidos = await this.prisma.lote.findMany({
        where: { status: 'ABERTO', fimEm: { lte: new Date() } },
        select: { id: true },
      });
      for (const { id } of vencidos) {
        await this.liquidar(id).catch((erro) => this.log.error(`Falha ao liquidar ${id}`, erro));
      }
    } catch (erro) {
      this.log.error('Falha na varredura de lotes vencidos', erro);
    } finally {
      this.rodando = false;
    }
  }

  async liquidar(loteId: string) {
    const resultado = await this.prisma.$transaction(
      async (tx) => {
        const [lote] = await tx.$queryRaw<LoteTravado[]>`
          SELECT "status"::text AS "status", "fimEm", "valorAtual", "liderId", "leiloeiroId"
          FROM "Lote" WHERE "id" = ${loteId}::uuid FOR UPDATE`;

        // Relê sob o lock: outra execução pode já ter liquidado, e um lance de última
        // hora pode ter prorrogado o fim depois que a varredura listou este lote.
        if (!lote || lote.status !== 'ABERTO' || lote.fimEm > new Date()) return null;

        if (!lote.liderId || lote.valorAtual === null) {
          await tx.lote.update({ where: { id: loteId }, data: { status: 'ENCERRADO' } });
          return { vencedorId: null, valor: null, arremateId: null };
        }

        // Mesma ordem do motor de lances (lote e depois carteiras por id), para não dar deadlock.
        for (const usuarioId of [lote.liderId, lote.leiloeiroId].sort()) {
          await tx.$queryRaw`SELECT 1 FROM "Carteira" WHERE "usuarioId" = ${usuarioId}::uuid FOR UPDATE`;
        }
        await tx.carteira.update({
          where: { usuarioId: lote.liderId },
          data: {
            saldoTotal: { decrement: lote.valorAtual },
            saldoComprometido: { decrement: lote.valorAtual },
          },
        });
        await tx.carteira.update({
          where: { usuarioId: lote.leiloeiroId },
          data: { saldoTotal: { increment: lote.valorAtual } },
        });
        const arremate = await tx.arremate.create({
          data: {
            loteId,
            vencedorId: lote.liderId,
            leiloeiroId: lote.leiloeiroId,
            valor: lote.valorAtual,
          },
        });
        await tx.lote.update({ where: { id: loteId }, data: { status: 'ENCERRADO' } });
        return { vencedorId: lote.liderId, valor: lote.valorAtual, arremateId: arremate.id };
      },
      { maxWait: 10_000, timeout: 10_000 },
    );

    if (resultado) {
      this.gateway.publicarEncerramento(loteId, resultado.vencedorId, resultado.valor, resultado.arremateId);
    }
    return resultado;
  }
}