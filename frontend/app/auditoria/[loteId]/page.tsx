import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
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

const curto = (hash: string | null) => (hash ? `${hash.slice(0, 12)}…` : '—');

export default async function AuditoriaPagina({ params }: { params: Promise<{ loteId: string }> }) {
  const a = await buscar((await params).loteId);
  const integro = a.selo === 'INTEGRO';

  return (
    <>
      <h1 className="text-3xl">Auditoria</h1>
      <p className="mb-4 text-suave">
        <Link href={`/lotes/${a.loteId}`}>{a.titulo}</Link> · {a.totalLances} {a.totalLances === 1 ? 'lance' : 'lances'}
      </p>

      <div className={`mb-6 border-2 px-4 py-3 ${integro ? 'border-ok text-ok' : 'border-erro text-erro'}`}>
        <div className="font-serif text-3xl">{integro ? 'Íntegro' : 'Adulterado'}</div>
        {!integro && a.problema && (
          <p className="text-sm">
            {PROBLEMAS[a.problema]}
            {a.primeiroInvalido !== null && ` Primeiro lance afetado: nº ${a.primeiroInvalido}.`}
          </p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="tabela text-sm">
          <thead>
            <tr>
              <th>Nº</th><th>Licitante</th><th>Instante (UTC)</th>
              <th className="text-right">Valor</th><th>Hash</th><th>Hash anterior</th>
            </tr>
          </thead>
          <tbody>
            {a.lances.map((l) => (
              <tr key={l.sequencia} className={l.sequencia === a.primeiroInvalido ? 'bg-erro/10' : ''}>
                <td>{l.sequencia}</td>
                <td>{l.licitante}</td>
                <td className="font-mono text-xs">{l.criadoEm}</td>
                <td className="text-right">{brl(l.valor)}</td>
                <td className="font-mono text-xs" title={l.hash}>{curto(l.hash)}</td>
                <td className="font-mono text-xs" title={l.hashAnterior ?? ''}>{curto(l.hashAnterior)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 max-w-2xl text-sm text-suave">
        Cada lance guarda o SHA-256 de id, valor, instante, licitante e hash do lance anterior. A verificação
        recalcula a cadeia inteira a cada consulta e compara o último lance com o estado do lote. Os licitantes
        aparecem anonimizados.
      </p>
    </>
  );
}