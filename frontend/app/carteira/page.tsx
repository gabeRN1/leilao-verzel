'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { brl, paraCentavos } from '@/lib/format';
import { useExigir } from '@/lib/sessao';
import type { Resumo } from '@/lib/tipos';

export default function Carteira() {
  const sessao = useExigir();
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const chamar = sessao?.chamar;

  useEffect(() => {
    if (!chamar) return;
    chamar<Resumo>('/carteira').then(setResumo).catch((e: Error) => setErro(e.message));
  }, [chamar]);

  if (!sessao) return null;

  async function depositar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const centavos = paraCentavos(valor);
    if (Number.isNaN(centavos)) return setErro('Informe um valor válido.');
    try {
      setResumo(await sessao!.chamar<Resumo>('/carteira/depositos', { corpo: { valor: centavos } }));
      setValor('');
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-4 text-3xl">Carteira</h1>
      {resumo && (
        <table className="tabela">
          <tbody>
            <tr><td>Saldo total</td><td className="text-right">{brl(resumo.saldoTotal)}</td></tr>
            <tr><td>Comprometido em lances</td><td className="text-right">{brl(resumo.saldoComprometido)}</td></tr>
            <tr className="font-medium"><td>Disponível</td><td className="text-right">{brl(resumo.saldoDisponivel)}</td></tr>
          </tbody>
        </table>
      )}

      {sessao.usuario?.papel === 'LICITANTE' && (
        <form onSubmit={depositar} className="mt-6">
          <label className="rotulo" htmlFor="deposito">Depósito simulado</label>
          <div className="mt-1 flex gap-2">
            <input id="deposito" value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="0,00" className="campo" />
            <button className="btn btn-cheio">Depositar</button>
          </div>
        </form>
      )}
      {erro && <p className="mt-2 text-sm text-erro">{erro}</p>}
    </div>
  );
}