'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

type Props = { valor: string | null; completo?: boolean; copiar?: boolean; rotulo?: string };

// Tela: hash curto com botão de copiar. Impressão: hash inteiro, em grupos de 8 para leitura e conferência.
// `rotulo` completa o nome acessível do botão ("Copiar hash do lance 3").
export function Hash({ valor, completo = false, copiar = true, rotulo = '' }: Props) {
  const [aviso, setAviso] = useState('');
  if (!valor) return <span>—</span>;
  const texto = valor;
  // Grupos são inline-block sem espaço entre eles: a quebra de linha respeita o grupo e a seleção copia o hash íntegro.
  const grupos = (texto.match(/.{1,8}/g) ?? [texto]).map((g, i) => (
    <span key={i} className="mr-[0.7ch] inline-block">{g}</span>
  ));

  async function copiarHash() {
    try {
      await navigator.clipboard.writeText(texto);
      setAviso('Hash copiado.');
    } catch {
      setAviso('Não foi possível copiar. Selecione o texto.');
    }
    setTimeout(() => setAviso(''), 3000);
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-3">
      <code className="num select-all text-sm" title={completo ? undefined : texto}>
        {completo ? (
          grupos
        ) : (
          <>
            <span className="print:hidden">{`${texto.slice(0, 12)}…`}</span>
            <span className="hidden print:inline">{grupos}</span>
          </>
        )}
      </code>
      {copiar && (
        <button
          type="button"
          onClick={copiarHash}
          aria-label={`Copiar hash ${rotulo}`.trim()}
          className="alvo gap-1.5 text-sm underline print:hidden"
        >
          {aviso === 'Hash copiado.' ? <Check aria-hidden size={14} /> : <Copy aria-hidden size={14} />}
          Copiar
        </button>
      )}
      <span role="status" className="text-sm text-suave print:hidden">{aviso}</span>
    </span>
  );
}
