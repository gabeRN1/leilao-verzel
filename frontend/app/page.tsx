import Link from 'next/link';
import { Categoria, Estado, marcaCategoria } from '@/components/estado';
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

type Busca = { status?: string; q?: string; cat?: string };
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
const normalizar = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const href = (p: Busca) => {
  const u = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]).toString();
  return u ? `/?${u}` : '/';
};

export default async function Vitrine({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const bruto = await searchParams;
  const q = um(bruto.q).trim();
  const cat = um(bruto.cat);
  const ativo = filtros.some(([valor]) => valor === um(bruto.status)) ? um(bruto.status) : '';
  const todos = await api<Lote[]>(`/lotes${ativo ? `?status=${ativo}` : ''}`);

  // Categorias vêm dos próprios lotes do estado escolhido, da mais frequente para a menos.
  const contagem = new Map<string, number>();
  for (const l of todos) {
    const c = l.atributos.classificacao;
    if (c) contagem.set(c, (contagem.get(c) ?? 0) + 1);
  }
  const categorias = [...contagem].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR')).slice(0, 8);
  if (cat && !categorias.some(([nome]) => nome === cat)) categorias.push([cat, contagem.get(cat) ?? 0]);

  const termo = normalizar(q);
  const lotes = todos.filter(
    (l) =>
      (!cat || l.atributos.classificacao === cat) &&
      (!termo ||
        normalizar([l.titulo, l.atributos.artista, l.atributos.classificacao, l.atributos.cultura].filter(Boolean).join(' ')).includes(termo)),
  );
  const filtrando = Boolean(q || cat);

  return (
    <>
      <header className="border-b-[3px] border-double border-tinta pb-4">
        <h1 className="text-5xl">Lotes</h1>

        <form role="search" action="/" className="mt-4 flex flex-wrap items-end gap-2">
          {ativo && <input type="hidden" name="status" value={ativo} />}
          {cat && <input type="hidden" name="cat" value={cat} />}
          <div className="min-w-0 flex-1 basis-56">
            <label htmlFor="q" className="rotulo">Buscar por título, artista ou cultura</label>
            <input id="q" name="q" type="search" defaultValue={q} autoComplete="off" className="campo mt-1" />
          </div>
          <button className="btn btn-cheio">Buscar</button>
          {filtrando && <Link href={href({ status: ativo })} className="alvo link">Limpar</Link>}
        </form>

        <div className="mt-4 grid gap-x-4 gap-y-2 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-center">
          <p id="f-estado" className="rotulo">Estado</p>
          <nav aria-labelledby="f-estado" className="flex flex-wrap gap-2">
            {filtros.map(([valor, rotulo]) => (
              <Link key={valor} href={href({ status: valor, q, cat })} aria-current={valor === ativo ? 'page' : undefined} className="filtro">
                {rotulo}
              </Link>
            ))}
          </nav>
          {categorias.length > 0 && (
            <>
              <p id="f-categoria" className="rotulo mt-1 sm:mt-0">Categoria</p>
              <nav aria-labelledby="f-categoria" className="flex flex-wrap gap-2">
                {categorias.map(([nome, n]) => (
                  <Link key={nome} href={href({ status: ativo, q, cat: cat === nome ? '' : nome })} aria-current={cat === nome ? 'page' : undefined} className="filtro">
                    <span aria-hidden className={`size-2 ${marcaCategoria(nome)}`} />
                    {nome}
                    <span className="num text-xs opacity-80">{n}</span>
                  </Link>
                ))}
              </nav>
            </>
          )}
        </div>
      </header>

      {lotes.length === 0 ? (
        <div className="vazio mt-6">
          <p className="font-serif text-xl">Nenhum lote encontrado</p>
          <p className="text-suave">
            {filtrando ? 'Nenhum lote corresponde à busca e à categoria escolhidas.' : 'Não há lotes neste estado.'}
          </p>
          {(filtrando || ativo) && <Link href="/" className="alvo link">Limpar filtros</Link>}
        </div>
      ) : (
        <>
          <p className="num my-2 text-sm text-suave">
            {filtrando ? `${lotes.length} de ${todos.length}` : lotes.length} {lotes.length === 1 ? 'lote' : 'lotes'}
          </p>
          <ul className="border-t border-tinta">
            {lotes.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/lotes/${l.id}`}
                  className={`grid grid-cols-[4rem_minmax(0,1fr)] items-start gap-x-4 gap-y-2 border-b border-l-2 ${
                    l.status === 'AO_VIVO' ? 'border-l-acento' : 'border-l-transparent'
                  } border-b-linha py-3 pl-3 hover:bg-tinta/5 hover:no-underline sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.imagemUrl} alt="" loading="lazy" className="size-16 bg-linha object-cover sm:size-20" />
                  <div className="min-w-0">
                    <div className="line-clamp-2 font-serif text-xl leading-tight">{l.titulo}</div>
                    <div className="truncate font-serif italic text-suave">
                      {[l.atributos.artista, l.atributos.datacao].filter(Boolean).join(' · ')}
                    </div>
                    {l.atributos.classificacao && (
                      <div className="mt-1"><Categoria nome={l.atributos.classificacao} /></div>
                    )}
                    <div className="mt-1 text-xs text-suave">
                      {l.status === 'AGENDADO' ? 'Começa ' : 'Termina '}
                      <span className="num">{dataHora(l.status === 'AGENDADO' ? l.inicioEm : l.fimEm)}</span>
                      {' · '}
                      <span className="num">{l.totalLances}</span> {l.totalLances === 1 ? 'lance' : 'lances'}
                    </div>
                  </div>
                  <div className="col-span-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-linha pt-2 sm:col-span-1 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                    <span className="rotulo">{l.valorAtual ? 'Lance atual' : 'Lance inicial'}</span>
                    <span className="valor text-lg">{brl(l.valorAtual ?? l.lanceInicial)}</span>
                    <Estado status={l.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
