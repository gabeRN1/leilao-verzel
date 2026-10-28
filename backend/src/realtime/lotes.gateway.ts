import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { isUUID } from 'class-validator';
import { Server, Socket } from 'socket.io';
import { anonimizar } from '../auditoria/anonimo';
import { ORIGENS } from '../origens';

@WebSocketGateway({ cors: { origin: ORIGENS } })
export class LotesGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer() private server!: Server;

  constructor(private jwt: JwtService) {}

  afterInit(server: Server) {
    server.use(async (socket, next) => {
      const token = socket.handshake.auth?.token;
      if (!token) return next();
      try {
        socket.data.usuarioId = (await this.jwt.verifyAsync(token)).sub;
        next();
      } catch {
        next(new Error('Token inválido'));
      }
    });
  }

  handleConnection(socket: Socket) {
    if (socket.data.usuarioId) socket.join(`usuario:${socket.data.usuarioId}`);
  }

  @SubscribeMessage('entrar')
  async entrar(@ConnectedSocket() socket: Socket, @MessageBody() loteId: string) {
    if (!isUUID(loteId)) return false;
    await socket.join(`lote:${loteId}`);
    return true;
  }

  // Quem lidera e quem foi superado recebe o evento na sala do próprio usuário.
  // O broadcast da sala leva só o licitante anonimizado.
  publicarLance(
    lance: { loteId: string; sequencia: number; valor: bigint; criadoEm: Date; fimEm: Date; prorrogado: boolean },
    liderId: string,
    liderAnteriorId: string | null,
  ) {
    const { loteId } = lance;
    const valor = lance.valor.toString();
    this.server.to(`lote:${loteId}`).emit('lance', { ...lance, valor, licitante: anonimizar(liderId) });
    this.server.to(`usuario:${liderId}`).emit('ganhando', { loteId, valor });
    if (liderAnteriorId) {
      this.server.to(`usuario:${liderAnteriorId}`).emit('superado', { loteId, valor });
    }
  }

  publicarEncerramento(loteId: string, vencedorId: string | null, valor: bigint | null, arremateId: string | null) {
    this.server.to(`lote:${loteId}`).emit('encerrado', {
      loteId,
      vencedor: vencedorId ? anonimizar(vencedorId) : null,
      valor: valor?.toString() ?? null,
    });
    if (vencedorId) {
      this.server
        .to(`usuario:${vencedorId}`)
        .emit('arrematado', { loteId, arremateId, valor: valor?.toString() });
    }
  }
}