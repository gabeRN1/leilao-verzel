import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { IsInt, Max, Min } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { Papeis, UsuarioAtual, type UsuarioAutenticado } from '../auth/decorators';
import { LancesService } from './lances.service';

class LanceDto {
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  valor!: number;
}

@Controller('lotes/:loteId/lances')
export class LancesController {
  constructor(private lances: LancesService) {}

  @Get()
  historico(@Param('loteId', ParseUUIDPipe) loteId: string) {
    return this.lances.historico(loteId);
  }

  @Get('situacao')
  @UseGuards(AuthGuard)
  @Papeis('LICITANTE')
  situacao(
    @Param('loteId', ParseUUIDPipe) loteId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.lances.situacao(loteId, usuario.id);
  }

  @Post()
  @UseGuards(AuthGuard)
  @Papeis('LICITANTE')
  dar(
    @Param('loteId', ParseUUIDPipe) loteId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body() { valor }: LanceDto,
  ) {
    return this.lances.dar(loteId, usuario.id, valor);
  }
}