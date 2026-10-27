'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { io } from 'socket.io-client';
import { Estado } from '@/components/estado';
import { agora, API_URL, ApiError } from '@/lib/api';
import { brl, duracao, emReais, hora, paraCentavos } from '@/lib/format';
import { useSessao } from '@/lib/sessao';
import type { LanceHistorico, Lote, Status } from '@/lib/tipos';

const ROTULOS: Record<string, string> = {
  artista: 'Artista',
  datacao: 'Datação',
  classificacao: 'Classificação',
  tecnica: 'Técnica',
  dimensoes: 'Dimensões',
  cultura: 'Cultura',
  numeroObjeto: 'Nº do objeto',
  credito: 'Crédito',
};
const JANELA_ANTISNIPING = 2 * 60_000;

type Situacao = 'GANHANDO' | 'SUPERADO' | null;
type EventoLance = LanceHistorico & { loteId: string; fimEm: string };

export default function Sala() {
  const { id } = useParams<{ id: string }>();
  const { token, usuario, pronta, chamar } = useSessao();
  const [lote, setLote] = useState<Lote | null>(null);
  const [lances, setLances] = useState<LanceHistorico[]>([]);
  const [situacao, setSituacao] = useState<Situacao>(null);
  const [encerrado, setEncerrado] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [agoraMs, setAgoraMs] = useState(0);
  const licitante = usuario?.papel === 'LICITANTE';

  const carregar = useCallback(async () => {
    try {
      const [l, h, s] = await Promise.all([
        chamar<Lote>(`/lotes/${id}`),
        chamar<LanceHistorico[]>(`/lotes/${id}/lances`),
        licitante
          ? chamar<{ lider: boolean; participou: boolean }>(`/lotes/${id}/lances/situacao`)
          : null,
      ]);
      setLote(l);
      setLances(h);
      setSituacao(s?.lider ? 'GANHANDO' : s?.participou ? 'SUPERADO' : null);
    } catch (e) {
      const naoExiste = e instanceof ApiError && (e.status === 404 || e.status === 400);
      setFalha(naoExiste ? 'Lote não encontrado.' : (e as Error).message);
    }
  }, [chamar, id, licitante]);

  useEffect(() => {
    if (pronta) void carregar();
  }, [pronta, carregar]);

  useEffect(() => {
    if (!pronta) return;
    const socket = io(API_URL, { auth: token ? { token } : {}, transports: ['websocket'] });
    socket.on('connect', () => socket.emit('entrar', id));
    // Eventos perdidos durante a queda não voltam: relê o estado ao reconectar.
    socket.io.on('reconnect', () => void carregar());

    socket.on('lance', (e: EventoLance) => {
      if (e.loteId !== id) return;
      setLote((l) => l && { ...l, valorAtual: e.valor, fimEm: e.fimEm, totalLances: e.sequencia });
      setLances((ls) =>
        ls.some((x) => x.sequencia === e.sequencia)
          ? ls
          : [{ sequencia: e.sequencia, valor: e.valor, criadoEm: e.criadoEm, licitante: e.licitante }, ...ls],
      );
    });
    socket.on('ganhando', (e: { loteId: string }) => e.loteId === id && setSituacao('GANHANDO'));
    socket.on('superado', (e: { loteId: string }) => e.loteId === id && setSituacao('SUPERADO'));
    socket.on('encerrado', (e: { loteId: string }) => e.loteId === id && setEncerrado(true));

    return () => {
      socket.disconnect();
    };
  }, [pronta, token, id, carregar]);

  useEffect(() => {
    setAgoraMs(agora());
    const t = setInterval(() => setAgoraMs(agora()), 250);
    return () => clearInterval(t);
  }, []);

  if (falha) return <p className="text-erro">{falha}</p>;
  if (!lote) return <p className="text-suave">Carregando…</p>;

  const inicio = new Date(lote.inicioEm).getTime();
  const fim = new Date(lote.fimEm).getTime();
  const status: Status =
    lote.status === 'CANCELADO'
      ? 'CANCELADO'
      : encerrado || lote.status === 'ENCERRADO' || agoraMs >= fim
        ? 'ENCERRADO'
        : agoraMs < inicio
          ? 'AGENDADO'
          : 'AO_VIVO';

  const restante = (status === 'AGENDADO' ? inicio : fim) - agoraMs;
  const naJanela = status === 'AO_VIVO' && restante <= JANELA_ANTISNIPING;
  const minimo = lote.valorAtual ? BigInt(lote.valorAtual) + BigInt(lote.incremento) : BigInt(lote.lanceInicial);
  const podeDarLance = licitante && status === 'AO_VIVO' && situacao !== 'GANHANDO';

  async function dar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const centavos = paraCentavos(valor);
    if (Number.isNaN(centavos)) return setErro('Informe um valor válido.');
    setEnviando(true);
    try {
      await chamar(`/lotes/${id}/lances`, { corpo: { valor: centavos } });
      setValor('');
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={lote.imagemUrl} alt={lote.titulo} className="max-h-[28rem] w-full bg-linha object-contain" />
        <dl className="mt-4 text-sm">
          {Object.entries(lote.atributos)
            .filter(([, v]) => v)
            .map(([chave, v]) => (
              <div key={chave} className="grid grid-cols-[7rem_1fr] border-b border-linha py-1.5">
                <dt className="text-suave">{ROTULOS[chave] ?? chave}</dt>
                <dd>{v}</dd>
              </div>
            ))}
        </dl>
      </div>

      <div>
        <div className="mb-1 flex items-center gap-3">
          <Estado status={status} />
          <span className="text-sm text-suave">Leiloeiro: {lote.leiloeiro}</span>
        </div>
        <h1 className="text-3xl leading-tight">{lote.titulo}</h1>

        <div className="mt-5 grid grid-cols-2 gap-6 border-y border-tinta py-4">
          <div>
            <div className="rotulo">{lote.valorAtual ? 'Lance atual' : 'Lance inicial'}</div>
            <div className="font-serif text-4xl">{brl(lote.valorAtual ?? lote.lanceInicial)}</div>
            <div className="text-sm text-suave">
              {lote.totalLances} {lote.totalLances === 1 ? 'lance' : 'lances'} · incremento {brl(lote.incremento)}
            </div>
          </div>
          <div>
            {(status === 'AGENDADO' || status === 'AO_VIVO') && (
              <>
                <div className="rotulo">{status === 'AGENDADO' ? 'Começa em' : 'Encerra em'}</div>
                <div className={`font-serif text-4xl ${naJanela ? 'text-erro' : ''}`}>{duracao(restante)}</div>
                {naJanela && <div className="text-sm text-erro">Lance agora estende o fim em 2 min</div>}
              </>
            )}
            {status === 'ENCERRADO' && (
              <>
                <div className="rotulo">Resultado</div>
                <div className="text-lg">
                  {lances[0] ? `Arrematado por ${lances[0].licitante}` : 'Encerrado sem lances'}
                </div>
              </>
            )}
            {status === 'CANCELADO' && <div className="text-lg">Cancelado pelo leiloeiro</div>}
          </div>
        </div>

        {licitante && situacao && (
          <p
            className={`mt-4 inline-block border px-2 py-1 text-sm font-medium ${
              situacao === 'GANHANDO' ? 'border-ok text-ok' : 'border-alerta text-alerta'
            }`}
          >
            {situacao === 'GANHANDO'
              ? status === 'ENCERRADO' ? 'Você arrematou este lote' : 'Ganhando'
              : 'Superado'}
          </p>
        )}
        {licitante && situacao === 'GANHANDO' && status === 'ENCERRADO' && (
          <Link href="/arremates" className="ml-3 text-sm underline">Ver comprovante</Link>
        )}

        {!usuario && pronta && status === 'AO_VIVO' && (
          <p className="mt-4 text-sm">
            <Link href="/entrar" className="underline">Entre</Link> como licitante para dar lances.
          </p>
        )}
        {usuario?.papel === 'LEILOEIRO' && (
          <p className="mt-4 text-sm text-suave">Leiloeiros não dão lances.</p>
        )}

        {podeDarLance && (
          <form onSubmit={dar} className="mt-4">
            <label className="rotulo" htmlFor="valor">Seu lance (mínimo {brl(minimo.toString())})</label>
            <div className="mt-1 flex gap-2">
              <input
                id="valor"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                className="campo"
              />
              <button type="button" className="btn whitespace-nowrap" onClick={() => setValor(emReais(minimo))}>
                Mínimo
              </button>
              <button className="btn btn-cheio" disabled={enviando}>Dar lance</button>
            </div>
            {erro && <p className="mt-2 text-sm text-erro">{erro}</p>}
          </form>
        )}

        <h2 className="mb-2 mt-8 text-xl">Histórico</h2>
        {lances.length === 0 ? (
          <p className="text-sm text-suave">Nenhum lance ainda.</p>
        ) : (
          <table className="tabela text-sm">
            <thead>
              <tr><th>Nº</th><th>Licitante</th><th>Hora</th><th className="text-right">Valor</th></tr>
            </thead>
            <tbody>
              {lances.map((l) => (
                <tr key={l.sequencia}>
                  <td>{l.sequencia}</td>
                  <td>{l.licitante}</td>
                  <td>{hora(l.criadoEm)}</td>
                  <td className="text-right">{brl(l.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p className="mt-6 text-sm">
          <Link href={`/auditoria/${lote.id}`} className="underline">Auditar a cadeia de lances</Link>
        </p>
      </div>
    </div>
  );
}