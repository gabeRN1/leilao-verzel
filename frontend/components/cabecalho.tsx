'use client';

import Link from 'next/link';
import { useSessao } from '@/lib/sessao';

export function Cabecalho() {
  const { usuario, pronta, sair } = useSessao();

  return (
    <header className="border-b border-tinta">
      <div className="mx-auto flex max-w-5xl flex-wrap items-baseline gap-x-6 gap-y-1 px-4 py-3">
        <Link href="/" className="font-serif text-xl">Leilão</Link>
        <nav className="flex gap-4 text-sm">
          <Link href="/">Vitrine</Link>
          {usuario?.papel === 'LICITANTE' && (
            <>
              <Link href="/carteira">Carteira</Link>
              <Link href="/arremates">Meus arremates</Link>
            </>
          )}
          {usuario?.papel === 'LEILOEIRO' && (
            <>
              <Link href="/painel">Painel</Link>
              <Link href="/carteira">Carteira</Link>
            </>
          )}
        </nav>
        <div className="ml-auto text-sm">
          {pronta &&
            (usuario ? (
              <>
                {usuario.nome} <span className="rotulo">{usuario.papel === 'LEILOEIRO' ? 'Leiloeiro' : 'Licitante'}</span>
                <button onClick={sair} className="ml-3 underline">Sair</button>
              </>
            ) : (
              <Link href="/entrar">Entrar</Link>
            ))}
        </div>
      </div>
    </header>
  );
}