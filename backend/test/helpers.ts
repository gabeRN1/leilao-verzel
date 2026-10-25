import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type StatusLote } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurar } from '../src/configurar';
import { PrismaService } from '../src/prisma/prisma.service';

export const MIN = 60_000;
export type Pessoa = { token: string; id: string };

export async function iniciarApp() {
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = modulo.createNestApplication();
  configurar(app);
  await app.listen(0);
  return app;
}

export function ambiente(app: INestApplication, prefixo: string) {
  const prisma = app.get(PrismaService);
  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });
  let contador = 0;

  async function registrar(papel: 'LEILOEIRO' | 'LICITANTE', saldo = 0): Promise<Pessoa> {
    const n = contador++;
    const { body } = await http()
      .post('/auth/registro')
      .send({ nome: `u${n}`, email: `${prefixo}-${n}@teste.com`, senha: '12345678', papel })
      .expect(201);
    if (saldo > 0) {
      await http().post('/carteira/depositos').set(auth(body.token)).send({ valor: saldo }).expect(201);
    }
    return { token: body.token, id: body.usuario.id };
  }

  function criarLote(
    leiloeiroId: string,
    { inicio = -1000, fim = 60 * MIN, status = 'ABERTO' as StatusLote } = {},
  ) {
    return prisma.lote.create({
      data: {
        leiloeiroId,
        titulo: 'Obra de teste',
        imagemUrl: 'https://exemplo.test/obra.jpg',
        atributos: {},
        origemId: '1',
        lanceInicial: 10_000n,
        incremento: 1_000n,
        inicioEm: new Date(Date.now() + inicio),
        fimEm: new Date(Date.now() + fim),
        status,
      },
    });
  }

  const dar = (loteId: string, token: string, valor: number) =>
    http().post(`/lotes/${loteId}/lances`).set(auth(token)).send({ valor });

  const vencer = (loteId: string) =>
    prisma.lote.update({ where: { id: loteId }, data: { fimEm: new Date(Date.now() - 1000) } });

  const carteira = (usuarioId: string) =>
    prisma.carteira.findUniqueOrThrow({ where: { usuarioId } });

  async function limpar() {
    const dono = { email: { startsWith: prefixo } };
    await prisma.arremate.deleteMany({ where: { lote: { leiloeiro: dono } } });
    await prisma.lance.deleteMany({ where: { lote: { leiloeiro: dono } } });
    await prisma.lote.deleteMany({ where: { leiloeiro: dono } });
    await prisma.carteira.deleteMany({ where: { usuario: dono } });
    await prisma.usuario.deleteMany({ where: dono });
  }

  return { prisma, http, auth, registrar, criarLote, dar, vencer, carteira, limpar };
}