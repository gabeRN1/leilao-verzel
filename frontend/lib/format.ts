const FUSO = 'America/Sao_Paulo';

export const brl = (centavos: string | number) =>
  (Number(centavos) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: FUSO, dateStyle: 'short', timeStyle: 'short' });

export const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: FUSO });

// Aceita "1.250,50", "1250,5", "1250.5", "1,250.50" e separador solto no fim ("1250,"). Devolve NaN para vazio, zero, mais de 2 casas ou texto inválido.
// O último separador é o decimal quando há os dois; ponto isolado com 3 dígitos depois ("1.250") é milhar, desde que o primeiro grupo tenha até 3 dígitos.
export function paraCentavos(texto: string) {
  let t = texto.replace(/R\$|\s/g, '').replace(/[.,]$/, '');
  const v = t.lastIndexOf(',');
  const p = t.lastIndexOf('.');
  if (v >= 0 && p >= 0) {
    const dec = Math.max(v, p);
    t = `${t.slice(0, dec).replace(/[.,]/g, '')}.${t.slice(dec + 1)}`;
  } else if (v >= 0) {
    t = t.split(',').length === 2 ? t.replace(',', '.') : '';
  } else if (p >= 0) {
    const partes = t.split('.');
    const decimal = partes.length === 2 && partes[1].length <= 2;
    const milhar = /^\d{1,3}$/.test(partes[0]) && partes.slice(1).every((g) => g.length === 3);
    t = decimal ? t : milhar ? partes.join('') : '';
  }
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(t);
  if (!m) return NaN;
  const centavos = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(centavos) && centavos > 0 ? centavos : NaN;
}

export const emReais = (centavos: bigint) => (Number(centavos) / 100).toFixed(2).replace('.', ',');

export function duracao(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const dias = Math.floor(s / 86400);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dias ? `${dias}d ` : ''}${p(Math.floor((s % 86400) / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}