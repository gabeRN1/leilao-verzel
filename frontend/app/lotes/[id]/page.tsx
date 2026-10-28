'use client';

import { ArrowDown, Check } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { io } from 'socket.io-client';
import { Categoria, Estado } from '@/components/estado';
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
const NUMERICOS = new Set(['datacao', 'dimensoes', 'numeroObjeto']);
const NAO_ENCONTRADO = 'Lote não encontrado.';
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
  const [avisos, setAvisos] = useState<{ id: number; texto: string }[]>([]);
  const contador = useRef(0);
  const campoRef = useRef<HTMLInputElement>(null);
  const licitante = usuario?.papel === 'LICITANTE';

  // Só eventos discretos (lance novo) entram na região viva; o timer nunca é anunciado.
  const avisar = useCallback((texto: string) => {
    setAvisos((a) => [...a.slice(-2), { id: ++contador.current, texto }]);
  }, []);

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
      setFalha(naoExiste ? NAO_ENCONTRADO : (e as Error).message);
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
      avisar(`Novo lance: ${brl(e.valor)}.`);
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
  }, [pronta, token, id, carregar, avisar]);

  useEffect(() => {
    setAgoraMs(agora());
    const t = setInterval(() => setAgoraMs(agora()), 250);
    return () => clearInterval(t);
  }, []);

  if (falha)
    return (
      <div>
        <p role="alert" className="text-erro">{falha}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {falha !== NAO_ENCONTRADO && (
            <button className="btn" onClick={() => { setFalha(null); void carregar(); }}>Tentar de novo</button>
          )}
          <Link href="/" className="btn">Voltar à vitrine</Link>
        </div>
      </div>
    );
  if (!lote) return <p role="status" className="text-suave">Carregando lote…</p>;

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
  const minutosJanela = JANELA_ANTISNIPING / 60_000;
  const previa = paraCentavos(valor);
  const abaixoDoMinimo = !Number.isNaN(previa) && BigInt(previa) < minimo;

  // Situação do licitante: cor + ícone + texto. Em lote cancelado não há situação a mostrar.
  const acabou = status === 'ENCERRADO';
  const tituloSituacao =
    situacao === 'GANHANDO'
      ? acabou ? 'Você arrematou este lote' : 'Você está ganhando'
      : acabou ? 'Você não arrematou este lote' : 'Você foi superado';
  const detalheSituacao =
    situacao === 'GANHANDO'
      ? acabou ? null : 'Seu lance é o maior até agora.'
      : acabou ? 'Outro licitante deu o maior lance.' : <>Para voltar à frente, o lance mínimo é <span className="num">{brl(minimo.toString())}</span>.</>;

  async function dar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const centavos = paraCentavos(valor);
    if (Number.isNaN(centavos)) {
      setErro('Informe um valor válido, como 1.250,50.');
      campoRef.current?.focus();
      return;
    }
    setEnviando(true);
    try {
      await chamar(`/lotes/${id}/lances`, { corpo: { valor: centavos } });
      setValor('');
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
      campoRef.current?.focus();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <div aria-live="polite" aria-atomic="false" aria-relevant="additions" className="sr-only">
        {avisos.map((a) => <p key={a.id}>{a.texto}</p>)}
        {status === 'ENCERRADO' && <p>Leilão encerrado.</p>}
      </div>

      <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1">
        <Estado status={status} />
        {lote.atributos.classificacao && <Categoria nome={lote.atributos.classificacao} />}
        <span className="text-sm text-suave">Leiloeiro: {lote.leiloeiro}</span>
      </div>
      <h1 className="break-words text-4xl leading-tight">{lote.titulo}</h1>
      {(lote.atributos.artista || lote.atributos.datacao) && (
        <p className="mt-1 font-serif text-lg italic text-suave">
          {[lote.atributos.artista, lote.atributos.datacao].filter(Boolean).join(' · ')}
        </p>
      )}

      {/* Valor e prazo: a faixa mais legível da página. O timer não está em região viva. */}
      <div className="mt-5 grid border-y-[3px] border-double border-y-tinta lg:grid-cols-[minmax(0,1fr)_auto] lg:divide-x">
        <div className="py-4 lg:pr-8">
          <div className="rotulo">{lote.valorAtual ? 'Lance atual' : 'Lance inicial'}</div>
          <div className="valor text-3xl leading-tight [overflow-wrap:anywhere] sm:text-5xl">{brl(lote.valorAtual ?? lote.lanceInicial)}</div>
          <div className="text-sm text-suave">
            <span className="num">{lote.totalLances}</span> {lote.totalLances === 1 ? 'lance' : 'lances'} · incremento{' '}
            <span className="num">{brl(lote.incremento)}</span>
          </div>
        </div>
        <div className="border-t border-linha py-4 lg:border-t-0 lg:pl-8">
          {(status === 'AGENDADO' || status === 'AO_VIVO') && (
            <>
              <div className="rotulo">{status === 'AGENDADO' ? 'Começa em' : 'Encerra em'}</div>
              <div className={`num text-3xl font-medium leading-tight sm:text-5xl ${naJanela ? 'text-ambar' : ''}`}>{duracao(restante)}</div>
              {status === 'AO_VIVO' && (
                <div className={`text-xs ${naJanela ? 'font-medium text-ambar' : 'text-suave'}`}>
                  {naJanela
                    ? <>Um lance agora estende o encerramento em <span className="num">{minutosJanela}</span> min.</>
                    : <>Lances nos últimos <span className="num">{minutosJanela}</span> min estendem o encerramento.</>}
                </div>
              )}
            </>
          )}
          {status === 'ENCERRADO' && (
            <>
              <div className="rotulo">Resultado</div>
              <div className="font-serif text-2xl leading-tight">
                {lances[0] ? `Arrematado por ${lances[0].licitante}` : 'Encerrado sem lances'}
              </div>
            </>
          )}
          {status === 'CANCELADO' && (
            <>
              <div className="rotulo">Resultado</div>
              <div className="font-serif text-2xl leading-tight">Cancelado pelo leiloeiro</div>
            </>
          )}
        </div>
      </div>

      {licitante && situacao && status !== 'CANCELADO' && (
        <div
          role="status"
          className={`mt-4 flex items-center gap-x-3 border-2 px-4 py-3 ${
            situacao === 'GANHANDO' ? 'border-ok bg-ok text-papel' : 'border-alerta bg-alerta/10 text-alerta'
          }`}
        >
          {situacao === 'GANHANDO' ? <Check aria-hidden size={28} strokeWidth={3} className="shrink-0" /> : <ArrowDown aria-hidden size={28} strokeWidth={3} className="shrink-0" />}
          <div className="min-w-0 flex-1">
            <p className="font-serif text-2xl leading-tight">{tituloSituacao}</p>
            {detalheSituacao && <p className="text-sm">{detalheSituacao}</p>}
          </div>
          {situacao === 'GANHANDO' && acabou && (
            <Link href="/arremates" className="alvo shrink-0 text-sm underline">Ver comprovante</Link>
          )}
        </div>
      )}

      <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* Lances antes da imagem no DOM: no celular o formulário vem primeiro; no desktop, md:order-last o põe à direita. */}
        <div className="min-w-0 md:order-last">
          {!usuario && pronta && status === 'AO_VIVO' && (
            <p className="mb-4 text-sm">
              <Link href="/entrar" className="alvo link">Entre</Link> como licitante para dar lances.
            </p>
          )}
          {usuario?.papel === 'LEILOEIRO' && (
            <p className="mb-4 text-sm text-suave">Leiloeiros não dão lances.</p>
          )}

          {podeDarLance && (
            <form onSubmit={dar} className="mb-8">
              <label className="rotulo" htmlFor="valor">Seu lance (R$)</label>
              <p id="valor-ajuda" className="text-sm text-suave">
                Mínimo <span className="num">{brl(minimo.toString())}</span>. Aceita 1.250,50 ou 1250.5.
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                <input
                  id="valor"
                  ref={campoRef}
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0,00"
                  aria-describedby={erro ? 'valor-ajuda valor-previa valor-erro' : 'valor-ajuda valor-previa'}
                  aria-invalid={erro ? true : undefined}
                  className="campo num w-auto min-w-0 flex-1 basis-32"
                />
                <button type="button" className="btn whitespace-nowrap" onClick={() => setValor(emReais(minimo))}>
                  Usar mínimo
                </button>
                <button className="btn btn-cheio" disabled={enviando}>{enviando ? 'Enviando…' : 'Dar lance'}</button>
              </div>
              {/* Mostra como o valor digitado foi lido; evita erro com "1.250" (mil duzentos e cinquenta) versus "1.25". */}
              <p id="valor-previa" className="num mt-1 min-h-5 text-sm text-suave">
                {valor && (Number.isNaN(previa) ? 'Valor não reconhecido.' : `Será enviado: ${brl(previa)}${abaixoDoMinimo ? ' (abaixo do mínimo)' : ''}`)}
              </p>
              {erro && <p id="valor-erro" role="alert" className="mt-1 text-sm text-erro">{erro}</p>}
            </form>
          )}

          <h2 className="mb-2 text-xl">Histórico</h2>
          {lances.length === 0 ? (
            <p className="text-sm text-suave">Nenhum lance ainda.</p>
          ) : (
            <div className="rolagem">
              <table className="tabela text-sm">
                <caption className="sr-only">Histórico de lances, do mais recente ao mais antigo</caption>
                <thead>
                  <tr>
                    <th scope="col">Nº</th><th scope="col">Licitante</th><th scope="col">Hora</th>
                    <th scope="col" className="text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {lances.map((l, i) => (
                    <tr key={l.sequencia} className={i === 0 ? 'bg-acento/10 font-medium' : ''}>
                      <td className="whitespace-nowrap">
                        <span className="num">{l.sequencia}</span>
                        {i === 0 && <span className="rotulo ml-2 text-acento">{acabou ? 'Arremate' : 'Líder'}</span>}
                      </td>
                      <td>{l.licitante}</td>
                      <td className="num whitespace-nowrap">{hora(l.criadoEm)}</td>
                      <td className="num whitespace-nowrap text-right">{brl(l.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-4 text-sm">
            <Link href={`/auditoria/${lote.id}`} className="alvo link">Auditar a cadeia de lances</Link>
          </p>
        </div>

        <div className="min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lote.imagemUrl} alt={lote.titulo} className="max-h-[28rem] w-full bg-linha object-contain" />
          <dl className="mt-4 text-sm">
            {Object.entries(lote.atributos)
              .filter(([, v]) => v)
              .map(([chave, v]) => (
                <div key={chave} className="grid grid-cols-[7rem_minmax(0,1fr)] border-b border-linha py-1.5">
                  <dt className="text-suave">{ROTULOS[chave] ?? chave}</dt>
                  <dd className={NUMERICOS.has(chave) ? 'num break-words' : 'break-words'}>{v}</dd>
                </div>
              ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
