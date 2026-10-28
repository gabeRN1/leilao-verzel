export default function VerificandoCadeia() {
  return (
    <div role="status" aria-busy="true">
      <h1 className="text-4xl">Auditoria</h1>
      <p className="mb-4 text-suave">Verificando a cadeia de lances…</p>
      <div aria-hidden className="space-y-2 motion-safe:animate-pulse">
        <div className="esqueleto h-16 w-full" />
        <div className="esqueleto h-5 w-full" />
        <div className="esqueleto h-5 w-full" />
        <div className="esqueleto h-5 w-2/3" />
      </div>
    </div>
  );
}
