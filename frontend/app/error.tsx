'use client';

import Link from 'next/link';

export default function Erro({ reset }: { reset: () => void }) {
  return (
    <div className="max-w-xl border-l-4 border-erro pl-4">
      <h1 className="text-2xl">Não foi possível carregar</h1>
      <p role="alert" className="my-2 text-suave">A API não respondeu ou retornou um erro. Verifique a conexão e tente novamente.</p>
      <div className="flex flex-wrap gap-3">
        <button className="btn" onClick={reset}>Tentar de novo</button>
        <Link href="/" className="btn">Voltar à vitrine</Link>
      </div>
    </div>
  );
}
