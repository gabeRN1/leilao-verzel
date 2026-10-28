import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Hash } from '@/components/hash';
import { Imprimir } from '@/components/imprimir';
import { api, ApiError } from '@/lib/api';
import { brl, dataHora } from '@/lib/format';
import type { Comprovante } from '@/lib/tipos';

async function buscar(id: string) {
  try {
    return await api<Comprovante>(`/arremates/${id}/comprovante`);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) notFound();
    throw e;
  }
}

export default async function ComprovantePagina({ params }: { params: Promise<{ id: string }> }) {
  const c = await buscar((await params).id);
  const linhas: [string, React.ReactNode][] = [
    ['Comprovante', <span key="id" className="num break-all text-sm">{c.id}</span>],
    ['Liquidado em', <span key="dt" className="num">{dataHora(c.liquidadoEm)}</span>],
    ['Obra', c.lote.titulo],
    ['Artista', c.lote.atributos.artista],
    ['Vencedor', c.vencedor],
    ['Leiloeiro', c.leiloeiro],
    ['Lances no lote', <span key="n" className="num">{c.totalLances}</span>],
    ['Valor arrematado', <strong key="v" className="valor text-xl">{brl(c.valor)}</strong>],
    ['Hash do último lance', <Hash key="h" valor={c.hashFinal} completo />],
  ];

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl">Comprovante de arremate</h1>
        <Imprimir />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={c.lote.imagemUrl} alt={c.lote.titulo} className="mb-4 max-h-64 max-w-full bg-linha object-contain" />
      <table className="tabela border-t-[3px] border-double border-t-tinta">
        <caption className="sr-only">Dados do arremate</caption>
        <tbody>
          {linhas.map(([rotulo, valor]) => (
            <tr key={rotulo}>
              <td className="w-28 font-serif italic text-suave sm:w-44">{rotulo}</td>
              <td className="break-words">{valor}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-sm text-suave">
        Guarde o hash do último lance: ele permite conferir, na página de auditoria, que a cadeia não foi alterada
        depois da liquidação.
      </p>
      <p className="text-sm print:hidden">
        <Link href={`/auditoria/${c.lote.id}`} className="alvo link">Abrir a página de auditoria</Link>
      </p>
    </div>
  );
}
