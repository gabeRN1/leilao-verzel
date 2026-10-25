import { Module } from '@nestjs/common';
import { LotesGateway } from './lotes.gateway';

@Module({ providers: [LotesGateway], exports: [LotesGateway] })
export class RealtimeModule {}