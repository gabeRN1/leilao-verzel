import { INestApplication, ValidationPipe } from '@nestjs/common';

declare global {
  interface BigInt {
    toJSON(): string;
  }
}

// Dinheiro é BigInt (centavos) e JSON.stringify não serializa BigInt. Vai como string.
BigInt.prototype.toJSON = function () {
  return this.toString();
};

export function configurar(app: INestApplication) {
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
}