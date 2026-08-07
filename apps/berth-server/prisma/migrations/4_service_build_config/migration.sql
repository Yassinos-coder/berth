-- Railway-style build config for git services
ALTER TABLE "Service"
  ADD COLUMN "rootDirectory" TEXT,
  ADD COLUMN "buildCommand" TEXT,
  ADD COLUMN "startCommand" TEXT;
