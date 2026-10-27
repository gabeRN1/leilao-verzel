import Link from 'next/link';
import { Estado } from '@/components/estado';
import { api } from '@/lib/api';
import { brl, dataHora } from '@/lib/format';
import type { Lote } from '@/lib/tipos';

const filtros = [
  ['', 'Todos'],
  ['AO_VIVO', 'Ao vivo'],
  ['AGENDADO', 'Agendados'],
  ['ENCERRADO', 'Encerrados'],
  ['CANCELADO', 'Cancelados'],
];

export default async function Vitrine({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const ativo = filtros.some(([valor]) => valor === status) ? (status ?? '') : '';
  const lotes = await api<Lote[]>(`/lotes${ativo ? `?status=${ativo}` : ''}`);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <h1 className="text-3xl">Lotes</h1>
        <nav className="flex gap-4 text-sm">
          {filtros.map(([valor, rotulo]) => (
            <Link
              key={valor}
              href={valor ? `/?status=${valor}` : '/'}
              className={valor === ativo ? 'font-medium underline' : 'text-suave'}
            >
              {rotulo}
            </Link>
          ))}
        </nav>
      </div>

      {lotes.length === 0 && <p className="text-suave">Nenhum lote neste filtro.</p>}

      <div className="border-t border-tinta">
        {lotes.map((l) => (
          <Link
            key={l.id}
            href={`/lotes/${l.id}`}
            className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-x-4 border-b border-linha py-3 hover:bg-tinta/5 hover:no-underline"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={l.imagemUrl} alt="" loading="lazy" className="h-16 w-[4.5rem] bg-linha object-cover" />
            <div className="min-w-0">
              <div className="truncate font-serif text-lg leading-tight">{l.titulo}</div>
              <div className="truncate text-sm text-suave">
                {[l.atributos.artista, l.atributos.datacao].filter(Boolean).join(' · ')}
              </div>
              <div className="mt-1 text-xs text-suave">
                {l.status === 'AGENDADO' ? `Começa ${dataHora(l.inicioEm)}` : `Termina ${dataHora(l.fimEm)}`}
                {' · '}
                {l.totalLances} {l.totalLances === 1 ? 'lance' : 'lances'}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="rotulo">{l.valorAtual ? 'Lance atual' : 'Lance inicial'}</span>
              <span className="text-lg font-medium">{brl(l.valorAtual ?? l.lanceInicial)}</span>
              <Estado status={l.status} />
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}