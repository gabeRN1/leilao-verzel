import type { Status } from '@/lib/tipos';

const rotulos: Record<Status, string> = {
  AGENDADO: 'Agendado',
  AO_VIVO: 'Ao vivo',
  ENCERRADO: 'Encerrado',
  CANCELADO: 'Cancelado',
};

// Cada estado tem cor própria; o texto sempre acompanha, e "Ao vivo" é o único preenchido.
const estilos: Record<Status, string> = {
  AGENDADO: 'border-marinho text-marinho',
  AO_VIVO: 'border-acento bg-acento text-papel',
  ENCERRADO: 'border-suave text-suave',
  CANCELADO: 'border-erro text-erro',
};

export function Estado({ status }: { status: Status }) {
  return (
    <span className={`rotulo inline-flex items-center border px-1.5 py-0.5 ${estilos[status]}`}>
      {status === 'AO_VIVO' && <span aria-hidden className="mr-1.5 inline-block size-1.5 bg-papel" />}
      {rotulos[status]}
    </span>
  );
}

// Categoria (classificação da obra) recebe sempre a mesma cor, derivada do nome.
const marcas = ['bg-acento', 'bg-marinho', 'bg-ok', 'bg-alerta', 'bg-ambar'];
export const marcaCategoria = (nome: string) =>
  marcas[[...nome].reduce((soma, c) => soma + c.charCodeAt(0), 0) % marcas.length];

export function Categoria({ nome }: { nome: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span aria-hidden className={`inline-block size-2 ${marcaCategoria(nome)}`} />
      {nome}
    </span>
  );
}
