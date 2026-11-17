-- AlterTable
ALTER TABLE "Server" ADD COLUMN "storageBudgetGb" INTEGER;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN "volumeLimited" BOOLEAN NOT NULL DEFAULT false;
