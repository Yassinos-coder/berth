-- Registry search + database templates: ports, volumes, command, connection metadata
ALTER TABLE "Service"
  ADD COLUMN "command" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "templateKind" TEXT,
  ADD COLUMN "containerPort" INTEGER,
  ADD COLUMN "publicNetworking" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "volumeName" TEXT,
  ADD COLUMN "volumePath" TEXT;
