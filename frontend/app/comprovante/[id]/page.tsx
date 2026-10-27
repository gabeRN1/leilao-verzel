import Link from 'next/link';
import { notFound } from 'next/navigation';
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
    ['Comprovante', <span key="id" className="break-all text-sm">{c.id}</span>],
    ['Liquidado em', dataHora(c.liquidadoEm)],
    ['Obra', c.lote.titulo],
    ['Artista', c.lote.atributos.artista],
    ['Vencedor', c.vencedor],
    ['Leiloeiro', c.leiloeiro],
    ['Lances no lote', c.totalLances],
    ['Valor arrematado', <strong key="v" className="text-lg">{brl(c.valor)}</strong>],
    ['Hash do último lance', <code key="h" className="break-all text-xs">{c.hashFinal}</code>],
  ];

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-3xl">Comprovante de arremate</h1>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={c.lote.imagemUrl} alt={c.lote.titulo} className="mb-4 max-h-64 bg-linha object-contain" />
      <table className="tabela">
        <tbody>
          {linhas.map(([rotulo, valor]) => (
            <tr key={rotulo}>
              <td className="w-44 text-suave">{rotulo}</td>
              <td>{valor}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-sm text-suave">
        Guarde o hash do último lance: ele permite conferir, na{' '}
        <Link href={`/auditoria/${c.lote.id}`} className="underline">página de auditoria</Link>, que a cadeia não foi alterada depois da liquidação.
      </p>
    </div>
  );
}