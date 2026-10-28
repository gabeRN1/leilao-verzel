'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { paraCentavos } from '@/lib/format';
import { useExigir } from '@/lib/sessao';
import type { Obra } from '@/lib/tipos';

// datetime-local espera horário local sem fuso.
const emLocal = (ms: number) =>
  new Date(ms - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export default function NovoLote() {
  const sessao = useExigir('LEILOEIRO');
  const router = useRouter();
  const [termo, setTermo] = useState('');
  const [obras, setObras] = useState<Obra[] | null>(null);
  const [escolhida, setEscolhida] = useState<Obra | null>(null);
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Preenchido no navegador: calcular no render causaria divergência entre servidor e cliente.
  useEffect(() => {
    setInicio(emLocal(Date.now() + 30_000));
    setFim(emLocal(Date.now() + 3_600_000));
  }, []);

  if (!sessao) return null;

  async function buscar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setBuscando(true);
    try {
      setObras(await sessao!.chamar<Obra[]>(`/lotes/obras?q=${encodeURIComponent(termo)}`));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setBuscando(false);
    }
  }

  async function criar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!escolhida) return setErro('Escolha uma obra.');
    const dados = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const lanceInicial = paraCentavos(dados.lanceInicial);
    const incremento = paraCentavos(dados.incremento);
    if (Number.isNaN(lanceInicial) || Number.isNaN(incremento)) return setErro('Valores inválidos. Use o formato 1.250,50.');

    setErro(null);
    setEnviando(true);
    try {
      await sessao!.chamar('/lotes', {
        corpo: {
          obraId: escolhida.obraId,
          lanceInicial,
          incremento,
          inicioEm: new Date(inicio).toISOString(),
          fimEm: new Date(fim).toISOString(),
        },
      });
      router.push('/painel');
    } catch (e) {
      setErro((e as Error).message);
      setEnviando(false);
    }
  }

  const descreve = erro ? 'valores-ajuda novo-erro' : 'valores-ajuda';

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-4xl">Novo lote</h1>

      <form onSubmit={buscar}>
        <label className="rotulo" htmlFor="busca">Buscar obra</label>
        <div className="mt-1 flex flex-wrap gap-2">
          <input
            id="busca"
            type="search"
            aria-describedby="busca-status"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Ex.: monet"
            minLength={2}
            required
            className="campo w-auto min-w-0 flex-1 basis-40"
          />
          <button className="btn" disabled={buscando}>{buscando ? 'Buscando…' : 'Buscar'}</button>
        </div>
      </form>

      <div id="busca-status" role="status" className="text-sm text-suave">
        {obras && !buscando && (obras.length === 0
          ? 'Nenhuma obra com imagem liberada.'
          : `${obras.length} ${obras.length === 1 ? 'obra encontrada' : 'obras encontradas'}.`)}
      </div>
      {obras && obras.length > 0 && (
        <ul className="mt-3 border-t border-tinta" aria-label="Obras encontradas">
          {obras.map((o) => {
            const sel = escolhida?.obraId === o.obraId;
            return (
              <li key={o.obraId}>
                <button
                  type="button"
                  aria-pressed={sel}
                  onClick={() => setEscolhida(o)}
                  className={`flex min-h-11 w-full items-center gap-3 border-b border-linha py-2 text-left ${
                    sel ? 'bg-acento text-papel' : 'hover:bg-tinta/5'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={o.imagemUrl} alt="" loading="lazy" className="h-12 w-12 shrink-0 bg-linha object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-serif">{o.titulo}</span>
                    <span className={`block truncate text-sm ${sel ? '' : 'text-suave'}`}>
                      {[o.artista, o.datacao].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {sel && <span className="rotulo shrink-0 pr-2 text-papel">Selecionada</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {escolhida && (
        <form onSubmit={criar} className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <p className="text-sm sm:col-span-2">
            Obra escolhida: <strong>{escolhida.titulo}</strong>
          </p>
          <p id="valores-ajuda" className="text-sm text-suave sm:col-span-2">
            Valores em reais. Aceita 1.250,50 ou 1250.5.
          </p>
          <label>
            <span className="rotulo">Lance inicial (R$)</span>
            <input name="lanceInicial" required inputMode="decimal" autoComplete="off" placeholder="0,00" aria-describedby={descreve} aria-invalid={erro ? true : undefined} className="campo num" />
          </label>
          <label>
            <span className="rotulo">Incremento mínimo (R$)</span>
            <input name="incremento" required inputMode="decimal" autoComplete="off" placeholder="0,00" aria-describedby={descreve} aria-invalid={erro ? true : undefined} className="campo num" />
          </label>
          <label>
            <span className="rotulo">Início</span>
            <input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} required aria-describedby={erro ? 'novo-erro' : undefined} className="campo num" />
          </label>
          <label>
            <span className="rotulo">Fim</span>
            <input type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} required aria-describedby={erro ? 'novo-erro' : undefined} className="campo num" />
          </label>
          <button className="btn btn-cheio sm:col-span-2" disabled={enviando}>{enviando ? 'Criando…' : 'Criar lote'}</button>
        </form>
      )}
      {erro && <p id="novo-erro" role="alert" className="mt-3 text-sm text-erro">{erro}</p>}
    </div>
  );
}
