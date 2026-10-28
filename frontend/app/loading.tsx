// Vale para toda rota sem loading.tsx próprio. Só o texto é anunciado; o esqueleto é decorativo e não anima com "reduzir movimento".
export default function Carregando() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <div aria-hidden className="motion-safe:animate-pulse">
        <div className="esqueleto h-10 w-40" />
        <div className="mt-6 border-t border-tinta">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 border-b border-linha py-3">
              <div className="esqueleto size-16 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="esqueleto h-5 w-3/4" />
                <div className="esqueleto h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
