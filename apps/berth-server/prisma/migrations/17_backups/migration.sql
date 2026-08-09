CREATE TYPE "BackupStatus" AS ENUM ('running', 'success', 'failed');

CREATE TABLE "BackupTarget" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT '',
    "accessKeyId" TEXT NOT NULL,
    "secretAccessKeyEncrypted" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupTarget_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BackupTarget_orgId_idx" ON "BackupTarget"("orgId");

ALTER TABLE "BackupTarget" ADD CONSTRAINT "BackupTarget_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Backup" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "backupTargetId" TEXT NOT NULL,
    "status" "BackupStatus" NOT NULL DEFAULT 'running',
    "objectKey" TEXT,
    "sizeBytes" BIGINT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Backup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Backup_orgId_idx" ON "Backup"("orgId");

CREATE INDEX "Backup_serviceId_idx" ON "Backup"("serviceId");

ALTER TABLE "Backup" ADD CONSTRAINT "Backup_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Backup" ADD CONSTRAINT "Backup_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Backup" ADD CONSTRAINT "Backup_backupTargetId_fkey" FOREIGN KEY ("backupTargetId") REFERENCES "BackupTarget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
