import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { LancesController } from './lances.controller';
import { LancesService } from './lances.service';

@Module({
  imports: [RealtimeModule],
  controllers: [LancesController],
  providers: [LancesService],
})
export class LancesModule {}