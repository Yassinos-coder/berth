ALTER TABLE "Organization" ADD COLUMN "panelDomain" TEXT;

CREATE UNIQUE INDEX "Organization_panelDomain_key"
ON "Organization"("panelDomain");
