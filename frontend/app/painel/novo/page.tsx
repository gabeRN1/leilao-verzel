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
    try {
      setObras(await sessao!.chamar<Obra[]>(`/lotes/obras?q=${encodeURIComponent(termo)}`));
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function criar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!escolhida) return setErro('Escolha uma obra.');
    const dados = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const lanceInicial = paraCentavos(dados.lanceInicial);
    const incremento = paraCentavos(dados.incremento);
    if (Number.isNaN(lanceInicial) || Number.isNaN(incremento)) return setErro('Valores inválidos.');

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

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-3xl">Novo lote</h1>

      <form onSubmit={buscar} className="flex gap-2">
        <input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Buscar obra (ex.: monet)" minLength={2} required className="campo" />
        <button className="btn">Buscar</button>
      </form>

      {obras?.length === 0 && <p className="mt-3 text-sm text-suave">Nenhuma obra com imagem liberada.</p>}
      {obras && obras.length > 0 && (
        <ul className="mt-3 border-t border-tinta">
          {obras.map((o) => (
            <li key={o.obraId}>
              <button
                type="button"
                onClick={() => setEscolhida(o)}
                className={`flex w-full items-center gap-3 border-b border-linha py-2 text-left ${
                  escolhida?.obraId === o.obraId ? 'bg-acento text-papel' : 'hover:bg-tinta/5'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={o.imagemUrl} alt="" loading="lazy" className="h-12 w-12 bg-linha object-cover" />
                <span className="min-w-0">
                  <span className="block truncate font-serif">{o.titulo}</span>
                  <span className="block truncate text-sm opacity-70">
                    {[o.artista, o.datacao].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {escolhida && (
        <form onSubmit={criar} className="mt-6 grid grid-cols-2 gap-3">
          <p className="col-span-2 text-sm">
            Obra escolhida: <strong>{escolhida.titulo}</strong>
          </p>
          <label>
            <span className="rotulo">Lance inicial (R$)</span>
            <input name="lanceInicial" required inputMode="decimal" placeholder="0,00" className="campo" />
          </label>
          <label>
            <span className="rotulo">Incremento mínimo (R$)</span>
            <input name="incremento" required inputMode="decimal" placeholder="0,00" className="campo" />
          </label>
          <label>
            <span className="rotulo">Início</span>
            <input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} required className="campo" />
          </label>
          <label>
            <span className="rotulo">Fim</span>
            <input type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} required className="campo" />
          </label>
          <button className="btn btn-cheio col-span-2" disabled={enviando}>Criar lote</button>
        </form>
      )}
      {erro && <p className="mt-3 text-sm text-erro">{erro}</p>}
    </div>
  );
}