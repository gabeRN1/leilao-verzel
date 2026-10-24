import { Module } from '@nestjs/common';
import { CarteiraController } from './carteira.controller';

@Module({ controllers: [CarteiraController] })
export class CarteiraModule {}