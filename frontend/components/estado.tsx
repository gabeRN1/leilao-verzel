import type { Status } from '@/lib/tipos';

const rotulos: Record<Status, string> = {
  AGENDADO: 'Agendado',
  AO_VIVO: 'Ao vivo',
  ENCERRADO: 'Encerrado',
  CANCELADO: 'Cancelado',
};

export function Estado({ status }: { status: Status }) {
  const vivo = status === 'AO_VIVO';
  return (
    <span className={`rotulo border px-1.5 py-0.5 ${vivo ? 'border-tinta bg-tinta text-papel' : ''}`}>
      {rotulos[status]}
    </span>
  );
}