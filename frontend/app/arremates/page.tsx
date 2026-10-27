'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { brl, dataHora } from '@/lib/format';
import { useExigir } from '@/lib/sessao';
import type { Arremate } from '@/lib/tipos';

export default function Arremates() {
  const sessao = useExigir('LICITANTE');
  const [lista, setLista] = useState<Arremate[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const chamar = sessao?.chamar;

  useEffect(() => {
    if (!chamar) return;
    chamar<Arremate[]>('/arremates/meus').then(setLista).catch((e: Error) => setErro(e.message));
  }, [chamar]);

  if (!sessao) return null;

  return (
    <>
      <h1 className="mb-4 text-3xl">Meus arremates</h1>
      {erro && <p className="text-erro">{erro}</p>}
      {lista?.length === 0 && <p className="text-suave">Você ainda não arrematou nenhum lote.</p>}
      {lista && lista.length > 0 && (
        <table className="tabela">
          <thead>
            <tr><th>Lote</th><th>Liquidado em</th><th className="text-right">Valor</th><th /></tr>
          </thead>
          <tbody>
            {lista.map((a) => (
              <tr key={a.id}>
                <td><Link href={`/lotes/${a.loteId}`}>{a.titulo}</Link></td>
                <td>{dataHora(a.liquidadoEm)}</td>
                <td className="text-right">{brl(a.valor)}</td>
                <td className="text-right"><Link href={`/comprovante/${a.id}`} className="underline">Comprovante</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}