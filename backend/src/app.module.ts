import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ArrematesModule } from './arremates/arremates.module';
import { AuthModule } from './auth/auth.module';
import { CarteiraModule } from './carteira/carteira.module';
import { LancesModule } from './lances/lances.module';
import { LiquidacaoModule } from './liquidacao/liquidacao.module';
import { LotesModule } from './lotes/lotes.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    CarteiraModule,
    LotesModule,
    LancesModule,
    LiquidacaoModule,
    ArrematesModule,
    AuditoriaModule,
  ],
})
export class AppModule {}