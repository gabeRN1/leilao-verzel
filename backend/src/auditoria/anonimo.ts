import { createHash } from 'node:crypto';

export const anonimizar = (id: string) =>
  '***' + createHash('sha256').update(id).digest('hex').slice(-4);