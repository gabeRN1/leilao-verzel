import { Prisma, StatusLote } from '@prisma/client';

export const STATUS_EXIBIDOS = ['AGENDADO', 'AO_VIVO', 'ENCERRADO', 'CANCELADO'] as const;
export type StatusExibido = (typeof STATUS_EXIBIDOS)[number];

export const incluir = {
  leiloeiro: { select: { nome: true } },
  _count: { select: { lances: true } },
} satisfies Prisma.LoteInclude;

type LoteCompleto = Prisma.LoteGetPayload<{ include: typeof incluir }>;

// ABERTO com fimEm vencido já aparece como ENCERRADO, mesmo antes de o scheduler liquidar.
export function statusDe(
  lote: { status: StatusLote; inicioEm: Date; fimEm: Date },
  agora = new Date(),
): StatusExibido {
  if (lote.status !== 'ABERTO') return lote.status;
  if (agora < lote.inicioEm) return 'AGENDADO';
  return agora < lote.fimEm ? 'AO_VIVO' : 'ENCERRADO';
}

export function filtroPorStatus(status: StatusExibido, agora = new Date()): Prisma.LoteWhereInput {
  switch (status) {
    case 'AGENDADO':
      return { status: 'ABERTO', inicioEm: { gt: agora } };
    case 'AO_VIVO':
      return { status: 'ABERTO', inicioEm: { lte: agora }, fimEm: { gt: agora } };
    case 'ENCERRADO':
      return { OR: [{ status: 'ENCERRADO' }, { status: 'ABERTO', fimEm: { lte: agora } }] };
    case 'CANCELADO':
      return { status: 'CANCELADO' };
  }
}

// Esconde líder e id do leiloeiro: o público não precisa saber quem lidera.
export function apresentar({ liderId, leiloeiroId, leiloeiro, _count, ...lote }: LoteCompleto) {
  return {
    ...lote,
    status: statusDe(lote),
    leiloeiro: leiloeiro.nome,
    totalLances: _count.lances,
  };
}