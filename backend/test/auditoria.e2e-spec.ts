import { type INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ambiente, iniciarApp } from './helpers';

describe('auditoria pública', () => {
  let app: INestApplication;
  let amb: ReturnType<typeof ambiente>;

  beforeAll(async () => {
    app = await iniciarApp();
    amb = ambiente(app, `auditoria-e2e-${Date.now()}`);
  });

  afterAll(async () => {
    await amb.limpar();
    await app.close();
  });

  async function loteComLances() {
    const leiloeiro = await amb.registrar('LEILOEIRO');
    const a = await amb.registrar('LICITANTE', 100_000);
    const b = await amb.registrar('LICITANTE', 100_000);
    const lote = await amb.criarLote(leiloeiro.id);
    await amb.dar(lote.id, a.token, 10_000).expect(201);
    await amb.dar(lote.id, b.token, 11_000).expect(201);
    await amb.dar(lote.id, a.token, 12_000).expect(201);
    return { lote, a, b };
  }

  const auditar = async (id: string) => (await amb.http().get(`/auditoria/${id}`).expect(200)).body;

  it('é pública, íntegra e anonimizada', async () => {
    const { lote, a, b } = await loteComLances();
    const corpo = await auditar(lote.id);

    expect(corpo).toMatchObject({ selo: 'INTEGRO', primeiroInvalido: null, problema: null, totalLances: 3 });
    expect(corpo.lances.map((l: { sequencia: number }) => l.sequencia)).toEqual([1, 2, 3]);
    const texto = JSON.stringify(corpo);
    for (const id of [a.id, b.id]) expect(texto).not.toContain(id);
    expect(corpo.lances[0].licitante).toMatch(/^\*\*\*[0-9a-f]{4}$/);
  });

  it('lote sem lances é íntegro', async () => {
    const leiloeiro = await amb.registrar('LEILOEIRO');
    const lote = await amb.criarLote(leiloeiro.id);
    expect(await auditar(lote.id)).toMatchObject({ selo: 'INTEGRO', totalLances: 0 });
  });

  it('valor adulterado no banco vira ADULTERADO e aponta o lance', async () => {
    const { lote } = await loteComLances();
    await amb.prisma.$executeRaw`UPDATE "Lance" SET "valor" = 1 WHERE "loteId" = ${lote.id}::uuid AND "sequencia" = 2`;
    expect(await auditar(lote.id)).toMatchObject({
      selo: 'ADULTERADO',
      primeiroInvalido: 2,
      problema: 'HASH_DIVERGENTE',
    });
  });

  it('licitante trocado no banco é detectado', async () => {
    const { lote, b } = await loteComLances();
    await amb.prisma.$executeRaw`UPDATE "Lance" SET "licitanteId" = ${b.id}::uuid WHERE "loteId" = ${lote.id}::uuid AND "sequencia" = 1`;
    expect(await auditar(lote.id)).toMatchObject({ selo: 'ADULTERADO', primeiroInvalido: 1 });
  });

  it('lance apagado do fim é detectado pela comparação com o lote', async () => {
    const { lote } = await loteComLances();
    await amb.prisma.$executeRaw`DELETE FROM "Lance" WHERE "loteId" = ${lote.id}::uuid AND "sequencia" = 3`;
    expect(await auditar(lote.id)).toMatchObject({ selo: 'ADULTERADO', problema: 'LOTE_DIVERGENTE' });
  });

  it('valorAtual adulterado no lote é detectado', async () => {
    const { lote } = await loteComLances();
    await amb.prisma.$executeRaw`UPDATE "Lote" SET "valorAtual" = 99999 WHERE "id" = ${lote.id}::uuid`;
    expect(await auditar(lote.id)).toMatchObject({ selo: 'ADULTERADO', problema: 'LOTE_DIVERGENTE' });
  });

  it('404 para lote inexistente e 400 para id malformado', async () => {
    await amb.http().get('/auditoria/00000000-0000-4000-8000-000000000000').expect(404);
    await amb.http().get('/auditoria/abc').expect(400);
  });
});