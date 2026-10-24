import { describe, expect, it } from 'vitest';
import { filtroPorStatus, statusDe } from './lote';

const agora = new Date('2026-01-01T12:00:00.000Z');
const em = (ms: number) => new Date(agora.getTime() + ms);
const HORA = 3_600_000;

describe('statusDe', () => {
  it('ABERTO antes do início é AGENDADO', () => {
    const lote = { status: 'ABERTO' as const, inicioEm: em(HORA), fimEm: em(2 * HORA) };
    expect(statusDe(lote, agora)).toBe('AGENDADO');
  });

  it('ABERTO dentro da janela é AO_VIVO, com início inclusivo', () => {
    const lote = { status: 'ABERTO' as const, inicioEm: agora, fimEm: em(HORA) };
    expect(statusDe(lote, agora)).toBe('AO_VIVO');
  });

  it('ABERTO com fimEm igual a agora já é ENCERRADO, com fim exclusivo', () => {
    const lote = { status: 'ABERTO' as const, inicioEm: em(-HORA), fimEm: agora };
    expect(statusDe(lote, agora)).toBe('ENCERRADO');
  });

  it('ABERTO vencido aparece como ENCERRADO antes de o scheduler liquidar', () => {
    const lote = { status: 'ABERTO' as const, inicioEm: em(-2 * HORA), fimEm: em(-HORA) };
    expect(statusDe(lote, agora)).toBe('ENCERRADO');
  });

  it.each(['ENCERRADO', 'CANCELADO'] as const)('%s persistido prevalece sobre o horário', (status) => {
    const lote = { status, inicioEm: em(-HORA), fimEm: em(HORA) };
    expect(statusDe(lote, agora)).toBe(status);
  });
});

describe('filtroPorStatus', () => {
  it('AGENDADO exige início futuro', () => {
    expect(filtroPorStatus('AGENDADO', agora)).toEqual({
      status: 'ABERTO',
      inicioEm: { gt: agora },
    });
  });

  it('AO_VIVO exige início passado e fim futuro', () => {
    expect(filtroPorStatus('AO_VIVO', agora)).toEqual({
      status: 'ABERTO',
      inicioEm: { lte: agora },
      fimEm: { gt: agora },
    });
  });

  it('ENCERRADO inclui os persistidos e os abertos já vencidos', () => {
    expect(filtroPorStatus('ENCERRADO', agora)).toEqual({
      OR: [{ status: 'ENCERRADO' }, { status: 'ABERTO', fimEm: { lte: agora } }],
    });
  });

  it('CANCELADO filtra só pelo status persistido', () => {
    expect(filtroPorStatus('CANCELADO', agora)).toEqual({ status: 'CANCELADO' });
  });
});