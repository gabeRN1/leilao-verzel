import { describe, expect, it } from 'vitest';
import { calcularHash } from './hash';
import { type LanceAuditado, verificarCadeia } from './cadeia';

function montar(valores: bigint[]): LanceAuditado[] {
  const lances: LanceAuditado[] = [];
  valores.forEach((valor, i) => {
    const base = {
      id: `lance-${i + 1}`,
      valor,
      criadoEm: new Date(Date.UTC(2026, 0, 1, 12, 0, i)),
      licitanteId: i % 2 ? 'ana' : 'bia',
      hashAnterior: lances[i - 1]?.hash ?? null,
    };
    lances.push({ ...base, sequencia: i + 1, hash: calcularHash(base) });
  });
  return lances;
}

const estado = (l: LanceAuditado[]) => ({ valorAtual: l.at(-1)!.valor, liderId: l.at(-1)!.licitanteId });

describe('verificarCadeia', () => {
  it('cadeia intacta é íntegra', () => {
    const lances = montar([100n, 110n, 120n]);
    expect(verificarCadeia(lances, estado(lances))).toEqual({
      integro: true,
      primeiroInvalido: null,
      problema: null,
    });
  });

  it('lote sem lances é íntegro', () => {
    expect(verificarCadeia([], { valorAtual: null, liderId: null })).toMatchObject({ integro: true });
  });

  it('alterar o valor de um lance aponta exatamente esse lance', () => {
    const lances = montar([100n, 110n, 120n]);
    lances[1].valor = 999n;
    expect(verificarCadeia(lances, estado(lances))).toEqual({
      integro: false,
      primeiroInvalido: 2,
      problema: 'HASH_DIVERGENTE',
    });
  });

  it('alterar o licitante ou o timestamp também é detectado', () => {
    const a = montar([100n, 110n]);
    a[0].licitanteId = 'intruso';
    expect(verificarCadeia(a, estado(a))).toMatchObject({ primeiroInvalido: 1, problema: 'HASH_DIVERGENTE' });

    const b = montar([100n, 110n]);
    b[1].criadoEm = new Date(b[1].criadoEm.getTime() + 1);
    expect(verificarCadeia(b, estado(b))).toMatchObject({ primeiroInvalido: 2, problema: 'HASH_DIVERGENTE' });
  });

  it('recalcular o hash do lance adulterado é pego pelo encadeamento do seguinte', () => {
    const lances = montar([100n, 110n, 120n]);
    lances[1].valor = 999n;
    lances[1].hash = calcularHash(lances[1]);
    expect(verificarCadeia(lances, estado(lances))).toEqual({
      integro: false,
      primeiroInvalido: 3,
      problema: 'ENCADEAMENTO_QUEBRADO',
    });
  });

  it('lance removido do meio quebra a sequência', () => {
    const lances = montar([100n, 110n, 120n]);
    lances.splice(1, 1);
    expect(verificarCadeia(lances, estado(lances))).toMatchObject({
      primeiroInvalido: 3,
      problema: 'SEQUENCIA_QUEBRADA',
    });
  });

  it('lance removido do fim só aparece na comparação com o lote', () => {
    const lances = montar([100n, 110n, 120n]);
    const lote = estado(lances);
    lances.pop();
    expect(verificarCadeia(lances, lote)).toEqual({
      integro: false,
      primeiroInvalido: null,
      problema: 'LOTE_DIVERGENTE',
    });
  });

  it('valorAtual ou líder alterados no lote são detectados', () => {
    const lances = montar([100n, 110n]);
    expect(verificarCadeia(lances, { ...estado(lances), valorAtual: 1n }).problema).toBe('LOTE_DIVERGENTE');
    expect(verificarCadeia(lances, { ...estado(lances), liderId: 'intruso' }).problema).toBe('LOTE_DIVERGENTE');
  });
});