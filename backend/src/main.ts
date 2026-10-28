import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configurar } from './configurar';
import { ORIGENS } from './origens';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configurar(app);
  app.enableCors({ origin: ORIGENS, exposedHeaders: ['Date'] });
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();