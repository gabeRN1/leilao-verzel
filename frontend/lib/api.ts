export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Desvio entre o relógio do navegador e o do servidor, atualizado a cada resposta.
// A contagem regressiva usa o servidor como referência: é ele quem decide quando o lote fecha.
let desvio = 0;
export const agora = () => Date.now() + desvio;

type Opcoes = { token?: string | null; corpo?: unknown; metodo?: string };

export async function api<T>(caminho: string, { token, corpo, metodo }: Opcoes = {}): Promise<T> {
  const resposta = await fetch(API_URL + caminho, {
    method: metodo ?? (corpo ? 'POST' : 'GET'),
    cache: 'no-store',
    headers: {
      ...(corpo ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });

  const data = resposta.headers.get('date');
  if (typeof window !== 'undefined' && data) desvio = new Date(data).getTime() - Date.now();

  if (resposta.status === 204) return undefined as T;
  const json = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const mensagem = json?.message;
    throw new ApiError(
      resposta.status,
      (Array.isArray(mensagem) ? mensagem.join(', ') : mensagem) ?? 'Erro inesperado',
    );
  }
  return json as T;
}