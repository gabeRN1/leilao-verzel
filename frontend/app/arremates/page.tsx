'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { brl, dataHora } from '@/lib/format';
import { useExigir } from '@/lib/sessao';
import type { Arremate } from '@/lib/tipos';

export default function Arremates() {
  const sessao = useExigir('LICITANTE');
  const [lista, setLista] = useState<Arremate[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const chamar = sessao?.chamar;

  const carregar = useCallback(() => {
    if (!chamar) return;
    setErro(null);
    chamar<Arremate[]>('/arremates/meus').then(setLista).catch((e: Error) => setErro(e.message));
  }, [chamar]);

  useEffect(carregar, [carregar]);

  if (!sessao) return null;

  return (
    <>
      <h1 className="mb-4 text-4xl">Meus arremates</h1>
      {erro && (
        <div>
          <p role="alert" className="mb-2 text-erro">{erro}</p>
          <button className="btn" onClick={carregar}>Tentar de novo</button>
        </div>
      )}
      {!lista && !erro && <p role="status" className="text-suave">Carregando…</p>}
      {lista?.length === 0 && (
        <div className="vazio">
          <p className="font-serif text-xl">Nenhum arremate</p>
          <p className="text-suave">Lotes em que você der o maior lance até o encerramento aparecem aqui, com comprovante.</p>
          <Link href="/" className="alvo link">Ver lotes</Link>
        </div>
      )}
      {lista && lista.length > 0 && (
        <div className="rolagem">
          <table className="tabela">
            <caption className="sr-only">Lotes arrematados</caption>
            <thead>
              <tr>
                <th scope="col">Lote</th><th scope="col">Liquidado em</th>
                <th scope="col" className="text-right">Valor</th><th scope="col"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.id}>
                  <td><Link href={`/lotes/${a.loteId}`} className="alvo">{a.titulo}</Link></td>
                  <td className="num whitespace-nowrap">{dataHora(a.liquidadoEm)}</td>
                  <td className="num whitespace-nowrap text-right">{brl(a.valor)}</td>
                  <td className="text-right"><Link href={`/comprovante/${a.id}`} className="alvo link">Comprovante</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
