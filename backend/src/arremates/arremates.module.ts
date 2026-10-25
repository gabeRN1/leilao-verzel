import { Module } from '@nestjs/common';
import { ArrematesController } from './arremates.controller';

@Module({ controllers: [ArrematesController] })
export class ArrematesModule {}