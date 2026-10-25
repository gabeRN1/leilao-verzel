import { anonimizar } from './anonimo';
import { calcularHash } from './hash';

export type LanceAuditado = {
  id: string;
  sequencia: number;
  valor: bigint;
  criadoEm: Date;
  licitanteId: string;
  hashAnterior: string | null;
  hash: string;
};

export type EstadoDoLote = { valorAtual: bigint | null; liderId: string | null };

export type Problema =
  | 'SEQUENCIA_QUEBRADA'
  | 'ENCADEAMENTO_QUEBRADO'
  | 'HASH_DIVERGENTE'
  | 'LOTE_DIVERGENTE';

// Percorre a cadeia em ordem e para no primeiro lance que não confere.
// O lote é comparado por último: alterar valorAtual ou liderId sem tocar nos lances também é adulteração.
export function verificarCadeia(lances: LanceAuditado[], lote: EstadoDoLote) {
  for (const [i, lance] of lances.entries()) {
    const anterior = lances[i - 1];
    let problema: Problema | null = null;

    if (lance.sequencia !== i + 1) problema = 'SEQUENCIA_QUEBRADA';
    else if (lance.hashAnterior !== (anterior?.hash ?? null)) problema = 'ENCADEAMENTO_QUEBRADO';
    else if (lance.hash !== calcularHash(lance)) problema = 'HASH_DIVERGENTE';

    if (problema) return { integro: false, primeiroInvalido: lance.sequencia, problema };
  }

  const ultimo = lances.at(-1);
  const divergente =
    (ultimo?.valor ?? null) !== lote.valorAtual || (ultimo?.licitanteId ?? null) !== lote.liderId;
  if (divergente) {
    return { integro: false, primeiroInvalido: null, problema: 'LOTE_DIVERGENTE' as const };
  }
  return { integro: true, primeiroInvalido: null, problema: null };
}

export const publicar = (lances: LanceAuditado[]) =>
  lances.map((l) => ({
    sequencia: l.sequencia,
    valor: l.valor,
    criadoEm: l.criadoEm,
    licitante: anonimizar(l.licitanteId),
    hashAnterior: l.hashAnterior,
    hash: l.hash,
  }));