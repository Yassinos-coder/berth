-- Reverse-proxy hosts (domain -> service:port) managed by the agent's Caddy
CREATE TABLE "ProxyHost" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "targetPort" INTEGER NOT NULL,
  "ssl" BOOLEAN NOT NULL DEFAULT true,
  "forceHttps" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProxyHost_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProxyHost_domain_key" ON "ProxyHost"("domain");
CREATE INDEX "ProxyHost_orgId_idx" ON "ProxyHost"("orgId");
CREATE INDEX "ProxyHost_serviceId_idx" ON "ProxyHost"("serviceId");
ALTER TABLE "ProxyHost" ADD CONSTRAINT "ProxyHost_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProxyHost" ADD CONSTRAINT "ProxyHost_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
