import { type INestApplication } from '@nestjs/common';
import { type AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { anonimizar } from '../src/auditoria/anonimo';
import { LiquidacaoService } from '../src/liquidacao/liquidacao.service';
import { ambiente, iniciarApp, MIN } from './helpers';

describe('realtime', () => {
  let app: INestApplication;
  let amb: ReturnType<typeof ambiente>;
  let porta: number;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    app = await iniciarApp();
    amb = ambiente(app, `realtime-e2e-${Date.now()}`);
    porta = (app.getHttpServer().address() as AddressInfo).port;
  });

  afterEach(() => {
    sockets.splice(0).forEach((s) => s.disconnect());
  });

  afterAll(async () => {
    await amb.limpar();
    await app.close();
  });

  function conectar(token?: string) {
    const socket = io(`http://localhost:${porta}`, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      forceNew: true,
    });
    sockets.push(socket);
    return new Promise<Socket>((resolve, reject) => {
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
    });
  }

  const receber = <T = any>(socket: Socket, evento: string) =>
    new Promise<T>((resolve) => socket.once(evento, resolve));

  async function cenario() {
    const leiloeiro = await amb.registrar('LEILOEIRO');
    const a = await amb.registrar('LICITANTE', 50_000);
    const b = await amb.registrar('LICITANTE', 50_000);
    const lote = await amb.criarLote(leiloeiro.id, { inicio: -10 * MIN });
    return { a, b, lote };
  }

  it('aceita conexão anônima e recusa token inválido', async () => {
    await conectar();
    await expect(conectar('lixo')).rejects.toThrow('Token inválido');
  });

  it('entrar só aceita id de lote válido', async () => {
    const socket = await conectar();
    expect(await socket.emitWithAck('entrar', 'abc')).toBe(false);
    expect(await socket.emitWithAck('entrar', '00000000-0000-4000-8000-000000000000')).toBe(true);
  });

  it('transmite o lance à sala com o licitante anonimizado', async () => {
    const { a, lote } = await cenario();
    const espectador = await conectar();
    await espectador.emitWithAck('entrar', lote.id);
    const recebidos: string[] = [];
    espectador.onAny((evento) => recebidos.push(evento));

    const lance = receber(espectador, 'lance');
    await amb.dar(lote.id, a.token, 10_000).expect(201);
    const evento = await lance;

    expect(evento).toMatchObject({
      loteId: lote.id,
      sequencia: 1,
      valor: '10000',
      prorrogado: false,
      licitante: anonimizar(a.id),
    });
    expect(JSON.stringify(evento)).not.toContain(a.id);

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(recebidos).toEqual(['lance']);
  });

  it('avisa quem passa a liderar e quem foi superado, só na sala do próprio usuário', async () => {
    const { a, b, lote } = await cenario();
    const socketA = await conectar(a.token);
    const socketB = await conectar(b.token);

    const aGanhando = receber(socketA, 'ganhando');
    await amb.dar(lote.id, a.token, 10_000).expect(201);
    expect(await aGanhando).toEqual({ loteId: lote.id, valor: '10000' });

    const aSuperado = receber(socketA, 'superado');
    const bGanhando = receber(socketB, 'ganhando');
    await amb.dar(lote.id, b.token, 11_000).expect(201);
    expect(await aSuperado).toEqual({ loteId: lote.id, valor: '11000' });
    expect(await bGanhando).toEqual({ loteId: lote.id, valor: '11000' });
  });

  it('informa o novo fim quando o lance prorroga o lote', async () => {
    const leiloeiro = await amb.registrar('LEILOEIRO');
    const a = await amb.registrar('LICITANTE', 50_000);
    const lote = await amb.criarLote(leiloeiro.id, { fim: 90_000 });
    const espectador = await conectar();
    await espectador.emitWithAck('entrar', lote.id);

    const lance = receber(espectador, 'lance');
    await amb.dar(lote.id, a.token, 10_000).expect(201);
    const evento = await lance;

    expect(evento.prorrogado).toBe(true);
    expect(new Date(evento.fimEm).getTime()).toBe(lote.fimEm.getTime() + 2 * MIN);
  });

  it('anuncia o encerramento à sala e o arremate ao vencedor', async () => {
    const { a, b, lote } = await cenario();
    const espectador = await conectar();
    await espectador.emitWithAck('entrar', lote.id);
    const socketB = await conectar(b.token);

    await amb.dar(lote.id, a.token, 10_000).expect(201);
    await amb.dar(lote.id, b.token, 11_000).expect(201);
    await amb.vencer(lote.id);

    const encerrado = receber(espectador, 'encerrado');
    const arrematado = receber(socketB, 'arrematado');
    await app.get(LiquidacaoService).liquidar(lote.id);

    expect(await encerrado).toEqual({ loteId: lote.id, vencedor: anonimizar(b.id), valor: '11000' });
    const meu = await arrematado;
    const arremate = await amb.prisma.arremate.findUniqueOrThrow({ where: { loteId: lote.id } });
    expect(meu).toEqual({ loteId: lote.id, arremateId: arremate.id, valor: '11000' });
  });
});