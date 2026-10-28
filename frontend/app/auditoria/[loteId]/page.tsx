import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Hash } from '@/components/hash';
import { Imprimir } from '@/components/imprimir';
import { brl } from '@/lib/format';
import type { Auditoria } from '@/lib/tipos';

const PROBLEMAS: Record<string, string> = {
  SEQUENCIA_QUEBRADA: 'A numeração dos lances tem lacuna ou repetição.',
  ENCADEAMENTO_QUEBRADO: 'O hash anterior de um lance não confere com o lance que o precede.',
  HASH_DIVERGENTE: 'Os dados de um lance não geram o hash gravado.',
  LOTE_DIVERGENTE: 'O valor ou o líder do lote não corresponde ao último lance.',
};

async function buscar(loteId: string) {
  try {
    return await api<Auditoria>(`/auditoria/${loteId}`);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) notFound();
    throw e;
  }
}

export default async function AuditoriaPagina({ params }: { params: Promise<{ loteId: string }> }) {
  const a = await buscar((await params).loteId);
  const integro = a.selo === 'INTEGRO';

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl">Auditoria</h1>
        <Imprimir />
      </div>
      <p className="mb-4 text-suave">
        <Link href={`/lotes/${a.loteId}`}>{a.titulo}</Link> · <span className="num">{a.totalLances}</span> {a.totalLances === 1 ? 'lance' : 'lances'}
      </p>

      <div className={`mb-6 border border-l-4 px-4 py-3 ${integro ? 'border-ok bg-ok/10 text-ok' : 'border-erro bg-erro/10 text-erro'}`}>
        <div className="font-serif text-4xl italic">{integro ? 'Íntegro' : 'Adulterado'}</div>
        {!integro && a.problema && (
          <p className="text-sm">
            {PROBLEMAS[a.problema]}
            {a.primeiroInvalido !== null && ` Primeiro lance afetado: nº ${a.primeiroInvalido}.`}
          </p>
        )}
      </div>

      {a.lances.length === 0 ? (
        <p className="text-suave">Nenhum lance registrado neste lote.</p>
      ) : (
        <div className="rolagem">
          <table className="tabela text-sm">
            <caption className="sr-only">Cadeia de lances com hash SHA-256</caption>
            <thead>
              <tr>
                <th scope="col">Nº</th><th scope="col">Licitante</th><th scope="col">Instante (UTC)</th>
                <th scope="col" className="text-right">Valor</th><th scope="col">Hash</th><th scope="col">Hash anterior</th>
              </tr>
            </thead>
            <tbody>
              {a.lances.map((l) => {
                const afetado = l.sequencia === a.primeiroInvalido;
                return (
                  <tr key={l.sequencia} className={afetado ? 'bg-erro/10' : ''}>
                    <td className="whitespace-nowrap">
                      <span className="num">{l.sequencia}</span>
                      {afetado && <span className="ml-2 font-medium text-erro">Afetado</span>}
                    </td>
                    <td>{l.licitante}</td>
                    <td className="num whitespace-nowrap text-xs">{l.criadoEm}</td>
                    <td className="num whitespace-nowrap text-right">{brl(l.valor)}</td>
                    <td><Hash valor={l.hash} rotulo={`do lance ${l.sequencia}`} /></td>
                    <td><Hash valor={l.hashAnterior} copiar={false} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 max-w-2xl text-sm text-suave">
        Cada lance guarda o SHA-256 de id, valor, instante, licitante e hash do lance anterior. A verificação
        recalcula a cadeia inteira a cada consulta e compara o último lance com o estado do lote. Os licitantes
        aparecem anonimizados.
      </p>
    </>
  );
}