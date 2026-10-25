import { createHash } from 'node:crypto';

export type DadosLance = {
  id: string;
  valor: bigint;
  criadoEm: Date;
  licitanteId: string;
  hashAnterior: string | null;
};

// O separador evita colisões por concatenação ("1"+"23" vs "12"+"3").
// O primeiro lance da cadeia usa string vazia no lugar do hash anterior.
export function calcularHash({ id, valor, criadoEm, licitanteId, hashAnterior }: DadosLance) {
  return createHash('sha256')
    .update([id, valor.toString(), criadoEm.toISOString(), licitanteId, hashAnterior ?? ''].join('|'))
    .digest('hex');
}