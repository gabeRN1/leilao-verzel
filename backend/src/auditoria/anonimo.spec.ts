import { describe, expect, it } from 'vitest';
import { anonimizar } from './anonimo';

describe('anonimizar', () => {
  const id = 'f0a906cc-a84f-438f-b420-b6a0914fcfe4';

  it('devolve *** seguido de 4 caracteres hexadecimais', () => {
    expect(anonimizar(id)).toMatch(/^\*\*\*[0-9a-f]{4}$/);
  });

  it('é determinístico', () => {
    expect(anonimizar(id)).toBe(anonimizar(id));
  });

  it('ids diferentes geram valores diferentes', () => {
    expect(anonimizar(id)).not.toBe(anonimizar('00000000-0000-4000-8000-000000000000'));
  });
});