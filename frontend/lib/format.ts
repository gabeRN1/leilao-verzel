const FUSO = 'America/Sao_Paulo';

export const brl = (centavos: string | number) =>
  (Number(centavos) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: FUSO, dateStyle: 'short', timeStyle: 'short' });

export const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: FUSO });

// Aceita "1.250,50" e "1250,5". Devolve NaN para vazio, zero ou texto inválido.
export function paraCentavos(texto: string) {
  const n = Number(texto.trim().replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : NaN;
}

export const emReais = (centavos: bigint) => (Number(centavos) / 100).toFixed(2).replace('.', ',');

export function duracao(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const dias = Math.floor(s / 86400);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dias ? `${dias}d ` : ''}${p(Math.floor((s % 86400) / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}