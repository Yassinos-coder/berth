-- AlterTable
ALTER TABLE "Service" ADD COLUMN "volumeUsedMb" INTEGER,
ADD COLUMN "volumeTotalMb" INTEGER,
ADD COLUMN "volumeUsageAt" TIMESTAMP(3);
