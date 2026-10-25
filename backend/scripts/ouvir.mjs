import { io } from 'socket.io-client';

const [loteId, token] = process.argv.slice(2);
const socket = io('http://localhost:3001', { auth: token ? { token } : {} });

socket.on('connect', async () => console.log('conectado, sala:', await socket.emitWithAck('entrar', loteId)));
socket.on('connect_error', (erro) => console.error('recusado:', erro.message));
socket.onAny((evento, dados) => console.log(evento, dados));