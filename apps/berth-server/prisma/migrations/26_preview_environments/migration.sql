ALTER TABLE "Service" ADD COLUMN "previewsEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "previewOfId" TEXT,
  ADD COLUMN "prNumber" INTEGER;

CREATE INDEX "Service_previewOfId_idx" ON "Service"("previewOfId");
CREATE UNIQUE INDEX "Service_previewOfId_prNumber_key" ON "Service"("previewOfId", "prNumber");

ALTER TABLE "Service" ADD CONSTRAINT "Service_previewOfId_fkey" FOREIGN KEY ("previewOfId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
