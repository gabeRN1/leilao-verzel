'use client';

// Usado no comprovante e na auditoria. A folha impressa vem do @media print em globals.css.
export function Imprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="btn print:hidden">
      Imprimir
    </button>
  );
}
