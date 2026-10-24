import {
  applyDecorators,
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Papeis, UsuarioAtual, type UsuarioAutenticado } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { apresentar, filtroPorStatus, incluir } from './lote';
import { BuscarObrasDto, CriarLoteDto, ListarLotesDto } from './lotes.dto';
import { buscarObra, buscarObras } from './obras';


const ComoLeiloeiro = () => applyDecorators(UseGuards(AuthGuard), Papeis('LEILOEIRO'));

// Cobre relógio do cliente e latência, para "começar agora" não ser recusado.
const TOLERANCIA_INICIO_MS = 60_000;

@Controller('lotes')
export class LotesController {
  constructor(private prisma: PrismaService) {}

  @Get('obras')
  @ComoLeiloeiro()
  buscar(@Query() { q }: BuscarObrasDto) {
    return buscarObras(q);
  }

  @Get('meus')
  @ComoLeiloeiro()
  async meus(@UsuarioAtual() usuario: UsuarioAutenticado) {
    const lotes = await this.prisma.lote.findMany({
      where: { leiloeiroId: usuario.id },
      orderBy: { criadoEm: 'desc' },
      include: incluir,
    });
    return lotes.map(apresentar);
  }

  @Get()
  async listar(@Query() { status }: ListarLotesDto) {
    const lotes = await this.prisma.lote.findMany({
      where: status ? filtroPorStatus(status) : undefined,
      orderBy: { fimEm: status === 'AO_VIVO' || status === 'AGENDADO' ? 'asc' : 'desc' },
      include: incluir,
      take: 100,
    });
    return lotes.map(apresentar);
  }

  @Get(':id')
  async detalhe(@Param('id', ParseUUIDPipe) id: string) {
    const lote = await this.prisma.lote.findUnique({ where: { id }, include: incluir });
    if (!lote) throw new NotFoundException('Lote não encontrado');
    return apresentar(lote);
  }

  @Post()
  @ComoLeiloeiro()
  async criar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body() { obraId, lanceInicial, incremento, inicioEm, fimEm }: CriarLoteDto,
  ) {
    if (inicioEm.getTime() < Date.now() - TOLERANCIA_INICIO_MS) {
      throw new BadRequestException('inicioEm não pode estar no passado');
    }
    if (fimEm <= inicioEm) {
      throw new BadRequestException('fimEm deve ser posterior a inicioEm');
    }

    const item = await buscarObra(obraId);
    const lote = await this.prisma.lote.create({
      data: {
        ...item,
        leiloeiroId: usuario.id,
        lanceInicial: BigInt(lanceInicial),
        incremento: BigInt(incremento),
        inicioEm,
        fimEm,
      },
      include: incluir,
    });
    return apresentar(lote);
  }

  @Delete(':id')
  @ComoLeiloeiro()
  @HttpCode(204)
  async cancelar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    // Um único UPDATE condicional. Checar os lances antes e cancelar depois deixaria
    // uma janela para um lance entrar no meio. `liderId: null` está na mesma linha
    // que o motor de lances trava, então o Postgres reavalia a condição após o lock.
    const { count } = await this.prisma.lote.updateMany({
      where: {
        id,
        leiloeiroId: usuario.id,
        status: 'ABERTO',
        liderId: null,
        fimEm: { gt: new Date() },
      },
      data: { status: 'CANCELADO' },
    });
    if (count > 0) return;

    const lote = await this.prisma.lote.findUnique({
      where: { id },
      select: { leiloeiroId: true },
    });
    if (!lote) throw new NotFoundException('Lote não encontrado');
    if (lote.leiloeiroId !== usuario.id) throw new ForbiddenException();
    throw new ConflictException('Só é possível cancelar lotes abertos e sem lances');
  }
}