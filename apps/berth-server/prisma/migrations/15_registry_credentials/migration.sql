CREATE TABLE "RegistryCredential" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "server" TEXT NOT NULL DEFAULT '',
    "username" TEXT NOT NULL,
    "passwordEncrypted" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistryCredential_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RegistryCredential_orgId_idx" ON "RegistryCredential"("orgId");

ALTER TABLE "RegistryCredential" ADD CONSTRAINT "RegistryCredential_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Service" ADD COLUMN "registryCredentialId" TEXT;

CREATE INDEX "Service_registryCredentialId_idx" ON "Service"("registryCredentialId");

ALTER TABLE "Service" ADD CONSTRAINT "Service_registryCredentialId_fkey" FOREIGN KEY ("registryCredentialId") REFERENCES "RegistryCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;
