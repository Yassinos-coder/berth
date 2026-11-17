-- CreateEnum
CREATE TYPE "DeployStrategy" AS ENUM ('rolling', 'recreate');

-- AlterTable
ALTER TABLE "Service" ADD COLUMN "deployStrategy" "DeployStrategy" NOT NULL DEFAULT 'rolling';
