'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Estado } from '@/components/estado';
import { brl, dataHora } from '@/lib/format';
import { useExigir } from '@/lib/sessao';
import type { Lote, Venda } from '@/lib/tipos';

export default function Painel() {
  const sessao = useExigir('LEILOEIRO');
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const chamar = sessao?.chamar;

  const carregar = useCallback(async () => {
    if (!chamar) return;
    try {
      const [l, v] = await Promise.all([chamar<Lote[]>('/lotes/meus'), chamar<Venda[]>('/arremates/vendas')]);
      setLotes(l);
      setVendas(v);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [chamar]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (!sessao) return null;

  async function cancelar(id: string) {
    setErro(null);
    try {
      await sessao!.chamar(`/lotes/${id}`, { metodo: 'DELETE' });
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-3xl">Meus lotes</h1>
        <Link href="/painel/novo" className="btn btn-cheio hover:no-underline">Novo lote</Link>
      </div>
      {erro && <p className="mb-2 text-sm text-erro">{erro}</p>}

      {lotes.length === 0 ? (
        <p className="text-suave">Você ainda não criou lotes.</p>
      ) : (
        <table className="tabela text-sm">
          <thead>
            <tr><th>Lote</th><th>Estado</th><th>Fim</th><th>Lances</th><th className="text-right">Atual</th><th /></tr>
          </thead>
          <tbody>
            {lotes.map((l) => (
              <tr key={l.id}>
                <td><Link href={`/lotes/${l.id}`}>{l.titulo}</Link></td>
                <td><Estado status={l.status} /></td>
                <td>{dataHora(l.fimEm)}</td>
                <td>{l.totalLances}</td>
                <td className="text-right">{l.valorAtual ? brl(l.valorAtual) : '—'}</td>
                <td className="space-x-3 text-right">
                  <Link href={`/auditoria/${l.id}`} className="underline">Auditoria</Link>
                  {l.totalLances === 0 && (l.status === 'AGENDADO' || l.status === 'AO_VIVO') && (
                    <button onClick={() => cancelar(l.id)} className="text-erro underline">Cancelar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="mb-2 mt-10 text-2xl">Resultados</h2>
      {vendas.length === 0 ? (
        <p className="text-suave">Nenhum lote liquidado ainda.</p>
      ) : (
        <table className="tabela text-sm">
          <thead>
            <tr><th>Lote</th><th>Vencedor</th><th>Liquidado em</th><th className="text-right">Valor</th><th /></tr>
          </thead>
          <tbody>
            {vendas.map((v) => (
              <tr key={v.id}>
                <td>{v.titulo}</td>
                <td>{v.vencedor}</td>
                <td>{dataHora(v.liquidadoEm)}</td>
                <td className="text-right">{brl(v.valor)}</td>
                <td className="text-right"><Link href={`/comprovante/${v.id}`} className="underline">Comprovante</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}