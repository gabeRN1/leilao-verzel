'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Estado } from '@/components/estado';
import { brl, dataHora } from '@/lib/format';
import { useExigir } from '@/lib/sessao';
import type { Lote, Status, Venda } from '@/lib/tipos';

const ESTADOS: Status[] = ['AO_VIVO', 'AGENDADO', 'ENCERRADO', 'CANCELADO'];
const TOPO: Record<Status, string> = {
  AO_VIVO: 'border-t-acento',
  AGENDADO: 'border-t-marinho',
  ENCERRADO: 'border-t-suave',
  CANCELADO: 'border-t-erro',
};

export default function Painel() {
  const sessao = useExigir('LEILOEIRO');
  const [lotes, setLotes] = useState<Lote[] | null>(null);
  const [vendas, setVendas] = useState<Venda[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<Lote | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [erroDialogo, setErroDialogo] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const dialogo = useRef<HTMLDialogElement>(null);
  const avisoRef = useRef<HTMLDivElement>(null);
  const chamar = sessao?.chamar;

  const carregar = useCallback(async () => {
    if (!chamar) return;
    setErro(null);
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

  // <dialog> nativo: foco preso, Esc fecha e o foco volta ao botão que abriu.
  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (alvo && !d.open) d.showModal();
    if (!alvo && d.open) d.close();
  }, [alvo]);

  // Após cancelar, o botão que abriu o diálogo some da tabela: o foco vai para o aviso.
  useEffect(() => {
    if (aviso) avisoRef.current?.focus();
  }, [aviso]);

  if (!sessao) return null;

  async function confirmar() {
    if (!alvo) return;
    setCancelando(true);
    setErroDialogo(null);
    try {
      await sessao!.chamar(`/lotes/${alvo.id}`, { metodo: 'DELETE' });
      setAviso(
        `Lote «${alvo.titulo}» cancelado. ${
          alvo.totalLances === 0
            ? 'Não havia lances: nenhum valor a estornar.'
            : 'Valores comprometidos em lances são estornados automaticamente.'
        }`,
      );
      setAlvo(null);
      await carregar();
    } catch (e) {
      setErroDialogo((e as Error).message);
    } finally {
      setCancelando(false);
    }
  }

  const carregando = erro ? null : <p role="status" className="text-suave">Carregando…</p>;
  const total = (vendas ?? []).reduce((soma, v) => soma + BigInt(v.valor), BigInt(0));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl">Meus lotes</h1>
        <Link href="/painel/novo" className="btn btn-cheio hover:no-underline">Novo lote</Link>
      </div>

      <div
        ref={avisoRef}
        role="status"
        tabIndex={-1}
        className={aviso ? 'mb-4 border border-l-4 border-ok bg-ok/10 px-3 py-2 text-sm focus:outline-none' : ''}
      >
        {aviso}
      </div>
      {erro && (
        <div className="mb-4">
          <p role="alert" className="mb-2 text-sm text-erro">{erro}</p>
          {lotes === null && <button className="btn" onClick={() => void carregar()}>Tentar de novo</button>}
        </div>
      )}

      {lotes && lotes.length > 0 && (
        <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ESTADOS.map((e) => (
            <div key={e} className={`border-t-4 bg-folha px-3 py-2 ${TOPO[e]}`}>
              <dt><Estado status={e} /></dt>
              <dd className="num mt-1 text-3xl font-medium">{lotes.filter((l) => l.status === e).length}</dd>
            </div>
          ))}
        </dl>
      )}

      {lotes === null ? (
        carregando
      ) : lotes.length === 0 ? (
        <div className="vazio">
          <p className="font-serif text-xl">Nenhum lote criado</p>
          <p className="text-suave">Escolha uma obra do acervo e defina lance inicial, incremento e horários.</p>
          <Link href="/painel/novo" className="alvo link">Criar o primeiro lote</Link>
        </div>
      ) : (
        <div className="rolagem">
          <table className="tabela text-sm">
            <caption className="sr-only">Lotes criados</caption>
            <thead>
              <tr>
                <th scope="col">Lote</th><th scope="col">Estado</th><th scope="col">Fim</th><th scope="col">Lances</th>
                <th scope="col" className="text-right">Atual</th><th scope="col"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {lotes.map((l) => (
                <tr key={l.id}>
                  <td><Link href={`/lotes/${l.id}`} className="alvo">{l.titulo}</Link></td>
                  <td><Estado status={l.status} /></td>
                  <td className="num whitespace-nowrap">{dataHora(l.fimEm)}</td>
                  <td className="num">{l.totalLances}</td>
                  <td className="num whitespace-nowrap text-right">{l.valorAtual ? brl(l.valorAtual) : '—'}</td>
                  <td>
                    <div className="flex justify-end gap-x-4 whitespace-nowrap">
                      <Link href={`/auditoria/${l.id}`} className="alvo link">Auditoria</Link>
                      {l.totalLances === 0 && (l.status === 'AGENDADO' || l.status === 'AO_VIVO') && (
                        <button
                          onClick={() => { setErroDialogo(null); setAlvo(l); }}
                          aria-label={`Cancelar lote ${l.titulo}`}
                          className="alvo text-erro underline"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mb-2 mt-10 flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 className="text-2xl">Resultados</h2>
        {vendas && vendas.length > 0 && (
          <p className="text-sm text-suave">Total liquidado <span className="valor text-lg">{brl(total.toString())}</span></p>
        )}
      </div>
      {vendas === null ? (
        carregando
      ) : vendas.length === 0 ? (
        <div className="vazio">
          <p className="font-serif text-xl">Nenhum lote liquidado</p>
          <p className="text-suave">Lotes encerrados com lance aparecem aqui, com o comprovante de cada arremate.</p>
        </div>
      ) : (
        <div className="rolagem">
          <table className="tabela text-sm">
            <caption className="sr-only">Lotes liquidados</caption>
            <thead>
              <tr>
                <th scope="col">Lote</th><th scope="col">Vencedor</th><th scope="col">Liquidado em</th>
                <th scope="col" className="text-right">Valor</th><th scope="col"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {vendas.map((v) => (
                <tr key={v.id}>
                  <td>{v.titulo}</td>
                  <td>{v.vencedor}</td>
                  <td className="num whitespace-nowrap">{dataHora(v.liquidadoEm)}</td>
                  <td className="num whitespace-nowrap text-right">{brl(v.valor)}</td>
                  <td className="text-right"><Link href={`/comprovante/${v.id}`} className="alvo link">Comprovante</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <dialog
        ref={dialogo}
        onClose={() => setAlvo(null)}
        aria-labelledby="cancelar-titulo"
        aria-describedby="cancelar-texto"
        className="dialogo"
      >
        {alvo && (
          <>
            <h2 id="cancelar-titulo" className="text-2xl">Cancelar este lote?</h2>
            <p className="mt-1 font-serif italic text-suave">{alvo.titulo}</p>
            <dl className="mt-3 text-sm">
              <div className="grid grid-cols-[6rem_minmax(0,1fr)] border-y border-linha py-1.5">
                <dt className="text-suave">Estado atual</dt>
                <dd><Estado status={alvo.status} /></dd>
              </div>
              <div className="grid grid-cols-[6rem_minmax(0,1fr)] border-b border-linha py-1.5">
                <dt className="text-suave">Lances</dt>
                <dd className="num">{alvo.totalLances}</dd>
              </div>
              <div className="grid grid-cols-[6rem_minmax(0,1fr)] border-b border-linha py-1.5">
                <dt className="text-suave">Estorno</dt>
                <dd className="font-medium text-ok">
                  Automático{alvo.totalLances === 0 ? ' · nada a devolver' : ' · valores voltam ao saldo disponível'}
                </dd>
              </div>
            </dl>
            <p id="cancelar-texto" className="mt-3 text-sm">
              {alvo.totalLances === 0
                ? 'Nenhum lance foi dado, então não há valor retido. '
                : 'Valores comprometidos em lances são estornados sem ação sua. '}
              O lote passa ao estado Cancelado e a interface não permite desfazer.
            </p>
            {erroDialogo && <p role="alert" className="mt-3 text-sm text-erro">{erroDialogo}</p>}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" autoFocus className="btn" onClick={() => setAlvo(null)}>Manter lote</button>
              <button type="button" className="btn btn-perigo" disabled={cancelando} onClick={() => void confirmar()}>
                {cancelando ? 'Cancelando…' : 'Cancelar lote'}
              </button>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
