import { Module } from '@nestjs/common';
import { LotesController } from './lotes.controller';

@Module({ controllers: [LotesController] })
export class LotesModule {}