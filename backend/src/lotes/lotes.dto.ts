import { Type } from 'class-transformer';
import { IsDate, IsIn, IsInt, IsOptional, MinLength, IsString, Max, Min } from 'class-validator';
import { STATUS_EXIBIDOS, type StatusExibido } from './lote';

export class CriarLoteDto {
  @IsInt()
  @Min(1)
  obraId!: number;   
  
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  lanceInicial!: number;

  @IsInt()
  @Min(1)
  @Max(100_000_000)
  incremento!: number;

  @Type(() => Date)
  @IsDate()
  inicioEm!: Date;

  @Type(() => Date)
  @IsDate()
  fimEm!: Date;
}

export class ListarLotesDto {
  @IsOptional()
  @IsIn(STATUS_EXIBIDOS)
  status?: StatusExibido;
}
export class BuscarObrasDto {
  @IsString()
  @MinLength(2)
  q!: string;
}