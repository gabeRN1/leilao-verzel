import { Module } from '@nestjs/common';
import { LancesController } from './lances.controller';
import { LancesService } from './lances.service';

@Module({ controllers: [LancesController], providers: [LancesService] })
export class LancesModule {}