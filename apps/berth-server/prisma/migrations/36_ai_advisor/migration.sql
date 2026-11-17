-- CreateEnum
CREATE TYPE "AdvisorSeverity" AS ENUM ('info', 'warning', 'critical');

-- CreateEnum
CREATE TYPE "AdvisorFindingStatus" AS ENUM ('open', 'applied', 'dismissed', 'superseded');

-- CreateTable
CREATE TABLE "AdvisorSettings" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT NOT NULL DEFAULT 'anthropic',
    "baseUrl" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "apiKeyEncrypted" TEXT,
    "monthlyCapUsd" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "priceInPerMTok" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceOutPerMTok" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "spentUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRunAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvisorSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisorFinding" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" "AdvisorSeverity" NOT NULL DEFAULT 'info',
    "source" TEXT NOT NULL DEFAULT 'rules',
    "status" "AdvisorFindingStatus" NOT NULL DEFAULT 'open',
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "action" JSONB,
    "undo" JSONB,
    "serviceId" TEXT,
    "serverId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "AdvisorFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisorRun" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "usedAi" BOOLEAN NOT NULL DEFAULT false,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "findings" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "AdvisorRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdvisorSettings_orgId_key" ON "AdvisorSettings"("orgId");

-- CreateIndex
CREATE INDEX "AdvisorFinding_orgId_status_idx" ON "AdvisorFinding"("orgId", "status");

-- CreateIndex
CREATE INDEX "AdvisorFinding_orgId_fingerprint_idx" ON "AdvisorFinding"("orgId", "fingerprint");

-- CreateIndex
CREATE INDEX "AdvisorRun_orgId_startedAt_idx" ON "AdvisorRun"("orgId", "startedAt");

-- AddForeignKey
ALTER TABLE "AdvisorSettings" ADD CONSTRAINT "AdvisorSettings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorFinding" ADD CONSTRAINT "AdvisorFinding_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorRun" ADD CONSTRAINT "AdvisorRun_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
