'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { brl, paraCentavos } from '@/lib/format';
import { useExigir } from '@/lib/sessao';
import type { Resumo } from '@/lib/tipos';

export default function Carteira() {
  const sessao = useExigir();
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const chamar = sessao?.chamar;

  const carregar = useCallback(() => {
    if (!chamar) return;
    setErro(null);
    chamar<Resumo>('/carteira').then(setResumo).catch((e: Error) => setErro(e.message));
  }, [chamar]);

  useEffect(carregar, [carregar]);

  if (!sessao) return null;
  const previa = paraCentavos(valor);

  async function depositar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const centavos = paraCentavos(valor);
    if (Number.isNaN(centavos)) return setErro('Informe um valor válido, como 1.250,50.');
    setEnviando(true);
    try {
      setResumo(await sessao!.chamar<Resumo>('/carteira/depositos', { corpo: { valor: centavos } }));
      setValor('');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-4 text-4xl">Carteira</h1>
      {!resumo && !erro && <p role="status" className="text-suave">Carregando saldo…</p>}
      {resumo && (
        <div className="rolagem">
          <table className="tabela">
            <caption className="sr-only">Saldo da carteira</caption>
            <tbody>
              <tr><td>Saldo total</td><td className="num text-right">{brl(resumo.saldoTotal)}</td></tr>
              <tr><td>Comprometido em lances</td><td className="num text-right text-ambar">{brl(resumo.saldoComprometido)}</td></tr>
              <tr className="font-medium"><td className="align-middle">Disponível</td><td className="valor text-right text-2xl">{brl(resumo.saldoDisponivel)}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {sessao.usuario?.papel === 'LICITANTE' && (
        <form onSubmit={depositar} className="mt-6">
          <label className="rotulo" htmlFor="deposito">Depósito simulado (R$)</label>
          <p id="deposito-ajuda" className="text-sm text-suave">Aceita 1.250,50 ou 1250.5.</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <input
              id="deposito"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              aria-describedby={erro ? 'deposito-ajuda deposito-previa carteira-erro' : 'deposito-ajuda deposito-previa'}
              aria-invalid={erro ? true : undefined}
              className="campo num w-auto min-w-0 flex-1 basis-32"
            />
            <button className="btn btn-cheio" disabled={enviando}>{enviando ? 'Enviando…' : 'Depositar'}</button>
          </div>
          <p id="deposito-previa" className="num mt-1 min-h-5 text-sm text-suave">
            {valor && (Number.isNaN(previa) ? 'Valor não reconhecido.' : `Será depositado: ${brl(previa)}`)}
          </p>
        </form>
      )}
      {erro && <p id="carteira-erro" role="alert" className="mt-2 text-sm text-erro">{erro}</p>}
      {erro && !resumo && <button className="btn mt-2" onClick={carregar}>Tentar de novo</button>}
    </div>
  );
}
