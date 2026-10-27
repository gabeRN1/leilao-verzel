'use client';

export default function Erro({ reset }: { reset: () => void }) {
  return (
    <div>
      <h1 className="text-2xl">Não foi possível carregar</h1>
      <p className="my-2 text-suave">A API não respondeu.</p>
      <button className="btn" onClick={reset}>Tentar de novo</button>
    </div>
  );
}