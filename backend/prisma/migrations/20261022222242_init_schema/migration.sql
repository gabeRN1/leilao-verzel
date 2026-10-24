-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('LEILOEIRO', 'LICITANTE');

-- CreateEnum
CREATE TYPE "StatusLote" AS ENUM ('ABERTO', 'ENCERRADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" "Papel" NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Carteira" (
    "usuarioId" UUID NOT NULL,
    "saldoTotal" BIGINT NOT NULL DEFAULT 0,
    "saldoComprometido" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "Carteira_pkey" PRIMARY KEY ("usuarioId")
);

-- CreateTable
CREATE TABLE "Lote" (
    "id" UUID NOT NULL,
    "leiloeiroId" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "imagemUrl" TEXT NOT NULL,
    "atributos" JSONB NOT NULL,
    "origemId" TEXT NOT NULL,
    "lanceInicial" BIGINT NOT NULL,
    "incremento" BIGINT NOT NULL,
    "inicioEm" TIMESTAMPTZ(3) NOT NULL,
    "fimEm" TIMESTAMPTZ(3) NOT NULL,
    "status" "StatusLote" NOT NULL DEFAULT 'ABERTO',
    "valorAtual" BIGINT,
    "liderId" UUID,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lance" (
    "id" UUID NOT NULL,
    "loteId" UUID NOT NULL,
    "licitanteId" UUID NOT NULL,
    "sequencia" INTEGER NOT NULL,
    "valor" BIGINT NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL,
    "hashAnterior" TEXT,
    "hash" TEXT NOT NULL,

    CONSTRAINT "Lance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Arremate" (
    "id" UUID NOT NULL,
    "loteId" UUID NOT NULL,
    "vencedorId" UUID NOT NULL,
    "leiloeiroId" UUID NOT NULL,
    "valor" BIGINT NOT NULL,
    "liquidadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Arremate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Lote_status_fimEm_idx" ON "Lote"("status", "fimEm");

-- CreateIndex
CREATE UNIQUE INDEX "Lance_hash_key" ON "Lance"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "Lance_loteId_sequencia_key" ON "Lance"("loteId", "sequencia");

-- CreateIndex
CREATE UNIQUE INDEX "Arremate_loteId_key" ON "Arremate"("loteId");

-- AddForeignKey
ALTER TABLE "Carteira" ADD CONSTRAINT "Carteira_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_leiloeiroId_fkey" FOREIGN KEY ("leiloeiroId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_liderId_fkey" FOREIGN KEY ("liderId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lance" ADD CONSTRAINT "Lance_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lance" ADD CONSTRAINT "Lance_licitanteId_fkey" FOREIGN KEY ("licitanteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arremate" ADD CONSTRAINT "Arremate_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arremate" ADD CONSTRAINT "Arremate_vencedorId_fkey" FOREIGN KEY ("vencedorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arremate" ADD CONSTRAINT "Arremate_leiloeiroId_fkey" FOREIGN KEY ("leiloeiroId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Carteira"
  ADD CONSTRAINT carteira_comprometido_nao_negativo CHECK ("saldoComprometido" >= 0),
  ADD CONSTRAINT carteira_total_cobre_comprometido CHECK ("saldoTotal" >= "saldoComprometido");

ALTER TABLE "Lote"
  ADD CONSTRAINT lote_janela_valida CHECK ("fimEm" > "inicioEm"),
  ADD CONSTRAINT lote_valores_positivos CHECK ("lanceInicial" > 0 AND "incremento" > 0);

ALTER TABLE "Lance"
  ADD CONSTRAINT lance_valor_positivo CHECK ("valor" > 0);