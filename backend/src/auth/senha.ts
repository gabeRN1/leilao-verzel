import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derivar = promisify(scrypt) as (
  senha: string,
  salt: Buffer,
  tamanho: number,
) => Promise<Buffer>;

export async function hashSenha(senha: string) {
  const salt = randomBytes(16);
  const chave = await derivar(senha, salt, 64);
  return `${salt.toString('hex')}:${chave.toString('hex')}`;
}

export async function conferirSenha(senha: string, armazenado: string) {
  const [salt, chave] = armazenado.split(':');
  const esperado = Buffer.from(chave, 'hex');
  const obtido = await derivar(senha, Buffer.from(salt, 'hex'), esperado.length);
  return timingSafeEqual(obtido, esperado);
}