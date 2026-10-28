import Link from 'next/link';

export default function NaoEncontrado() {
  return (
    <div>
      <h1 className="text-2xl">Página não encontrada</h1>
      <p className="my-2 text-suave">O endereço não existe ou o registro foi removido.</p>
      <Link href="/" className="btn">Voltar à vitrine</Link>
    </div>
  );
}
