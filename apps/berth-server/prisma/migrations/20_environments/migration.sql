CREATE TABLE "Environment" (
  "id" TEXT NOT NULL, "orgId" TEXT NOT NULL, "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "isProduction" BOOLEAN NOT NULL DEFAULT false, "preview" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Environment_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Service" ADD COLUMN "environmentId" TEXT;
CREATE UNIQUE INDEX "Environment_orgId_slug_key" ON "Environment"("orgId", "slug");
CREATE INDEX "Environment_orgId_idx" ON "Environment"("orgId");
CREATE INDEX "Service_environmentId_idx" ON "Service"("environmentId");
ALTER TABLE "Environment" ADD CONSTRAINT "Environment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Service" ADD CONSTRAINT "Service_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
