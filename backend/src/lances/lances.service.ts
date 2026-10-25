import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { calcularHash } from '../auditoria/hash';
import { PrismaService } from '../prisma/prisma.service';

const DOIS_MINUTOS = 2 * 60_000;

type LoteTravado = {
  status: string;
  inicioEm: Date;
  fimEm: Date;
  lanceInicial: bigint;
  incremento: bigint;
  valorAtual: bigint | null;
  liderId: string | null;
};

@Injectable()
export class LancesService {
  constructor(private prisma: PrismaService) {}

  dar(loteId: string, licitanteId: string, valorInformado: number) {
    const valor = BigInt(valorInformado);

    return this.prisma.$transaction(
      async (tx) => {
        // O FOR UPDATE serializa todos os lances do mesmo lote. Sem ele, dois lances
        // leriam o mesmo valorAtual e a mesma ponta da cadeia, e ambos seriam aceitos.
        const [lote] = await tx.$queryRaw<LoteTravado[]>`
          SELECT "status"::text AS "status", "inicioEm", "fimEm", "lanceInicial",
                 "incremento", "valorAtual", "liderId"
          FROM "Lote" WHERE "id" = ${loteId}::uuid FOR UPDATE`;
        if (!lote) throw new NotFoundException('Lote não encontrado');

        // O relógio é lido depois do lock: quem esperou na fila é avaliado no instante real.
        const agora = new Date();
        if (lote.status !== 'ABERTO' || agora < lote.inicioEm || agora >= lote.fimEm) {
          throw new ConflictException('Lote não está ao vivo');
        }
        if (lote.liderId === licitanteId) {
          throw new ConflictException('Você já lidera este lote');
        }

        const minimo =
          lote.valorAtual === null ? lote.lanceInicial : lote.valorAtual + lote.incremento;
        if (valor < minimo) {
          throw new UnprocessableEntityException(`Lance mínimo: ${minimo} centavos`);
        }

        // Ordem fixa por id: dois lances em lotes diferentes que cruzam as mesmas duas
        // carteiras (A lidera um, B lidera o outro) travariam em ordem oposta e dariam deadlock.
        const carteiras = [licitanteId, lote.liderId]
          .filter((id): id is string => id !== null)
          .sort();
        for (const usuarioId of carteiras) {
          await tx.$queryRaw`SELECT 1 FROM "Carteira" WHERE "usuarioId" = ${usuarioId}::uuid FOR UPDATE`;
        }

        const carteira = await tx.carteira.findUniqueOrThrow({ where: { usuarioId: licitanteId } });
        if (carteira.saldoTotal - carteira.saldoComprometido < valor) {
          throw new UnprocessableEntityException('Saldo disponível insuficiente');
        }

        if (lote.liderId && lote.valorAtual !== null) {
          await tx.carteira.update({
            where: { usuarioId: lote.liderId },
            data: { saldoComprometido: { decrement: lote.valorAtual } },
          });
        }
        await tx.carteira.update({
          where: { usuarioId: licitanteId },
          data: { saldoComprometido: { increment: valor } },
        });

        const anterior = await tx.lance.findFirst({
          where: { loteId },
          orderBy: { sequencia: 'desc' },
        });
        const lance = {
          id: randomUUID(),
          loteId,
          licitanteId,
          sequencia: (anterior?.sequencia ?? 0) + 1,
          valor,
          criadoEm: agora,
          hashAnterior: anterior?.hash ?? null,
        };
        await tx.lance.create({ data: { ...lance, hash: calcularHash(lance) } });

        const prorrogado = lote.fimEm.getTime() - agora.getTime() <= DOIS_MINUTOS;
        const fimEm = prorrogado ? new Date(lote.fimEm.getTime() + DOIS_MINUTOS) : lote.fimEm;
        await tx.lote.update({
          where: { id: loteId },
          data: { valorAtual: valor, liderId: licitanteId, fimEm },
        });

        return {
          lance: { id: lance.id, sequencia: lance.sequencia, valor, criadoEm: agora },
          fimEm,
          prorrogado,
        };
      },
      // Lances concorrentes esperam o lock dentro da transação e seguram uma conexão do pool.
      { maxWait: 10_000, timeout: 10_000 },
    );
  }
}