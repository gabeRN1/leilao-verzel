import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { calcularHash, type DadosLance } from './hash';

const base: DadosLance = {
  id: 'lance-1',
  valor: 1000n,
  criadoEm: new Date('2026-01-01T12:00:00.000Z'),
  licitanteId: 'licitante-1',
  hashAnterior: null,
};

describe('calcularHash', () => {
  it('segue a fórmula SHA256(id|valor|timestamp|licitante|hashAnterior)', () => {
    const esperado = createHash('sha256')
      .update('lance-1|1000|2026-01-01T12:00:00.000Z|licitante-1|')
      .digest('hex');
    expect(calcularHash(base)).toBe(esperado);
  });

  it('é determinístico e devolve 64 caracteres hexadecimais', () => {
    expect(calcularHash(base)).toBe(calcularHash({ ...base }));
    expect(calcularHash(base)).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each([
    ['id', { id: 'lance-2' }],
    ['valor', { valor: 1001n }],
    ['timestamp, mesmo por 1 ms', { criadoEm: new Date('2026-01-01T12:00:00.001Z') }],
    ['licitante', { licitanteId: 'licitante-2' }],
    ['hash anterior', { hashAnterior: 'abc' }],
  ] as [string, Partial<DadosLance>][])('muda quando o %s muda', (_, alteracao) => {
    expect(calcularHash({ ...base, ...alteracao })).not.toBe(calcularHash(base));
  });

  it('o separador impede colisão por concatenação entre campos vizinhos', () => {
    const a = calcularHash({ ...base, id: '1', valor: 23n });
    const b = calcularHash({ ...base, id: '12', valor: 3n });
    expect(a).not.toBe(b);
  });

  it('o encadeamento propaga: alterar o hash anterior muda o hash seguinte', () => {
    const primeiro = calcularHash(base);
    const segundo = calcularHash({ ...base, id: 'lance-2', hashAnterior: primeiro });
    const adulterado = calcularHash({ ...base, id: 'lance-2', hashAnterior: calcularHash({ ...base, valor: 1n }) });
    expect(segundo).not.toBe(adulterado);
  });
});