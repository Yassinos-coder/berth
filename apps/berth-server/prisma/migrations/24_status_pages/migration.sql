CREATE TABLE "StatusPage" (
  "id" TEXT NOT NULL, "orgId" TEXT NOT NULL, "slug" TEXT NOT NULL, "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '', "serviceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "published" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "StatusPage_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "StatusIncident" (
  "id" TEXT NOT NULL, "statusPageId" TEXT NOT NULL, "title" TEXT NOT NULL, "message" TEXT NOT NULL,
  "resolved" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3), CONSTRAINT "StatusIncident_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StatusPage_slug_key" ON "StatusPage"("slug");
CREATE INDEX "StatusPage_orgId_idx" ON "StatusPage"("orgId");
CREATE INDEX "StatusIncident_statusPageId_createdAt_idx" ON "StatusIncident"("statusPageId", "createdAt");
ALTER TABLE "StatusPage" ADD CONSTRAINT "StatusPage_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StatusIncident" ADD CONSTRAINT "StatusIncident_statusPageId_fkey" FOREIGN KEY ("statusPageId") REFERENCES "StatusPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
