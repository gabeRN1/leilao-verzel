import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { LiquidacaoService } from './liquidacao.service';

@Module({ imports: [RealtimeModule], providers: [LiquidacaoService] })
export class LiquidacaoModule {}