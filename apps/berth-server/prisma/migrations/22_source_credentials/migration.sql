CREATE TYPE "GitProvider" AS ENUM ('gitlab', 'bitbucket');
CREATE TABLE "SourceCredential" (
  "id" TEXT NOT NULL, "orgId" TEXT NOT NULL, "provider" "GitProvider" NOT NULL,
  "name" TEXT NOT NULL, "host" TEXT NOT NULL, "username" TEXT NOT NULL,
  "tokenEncrypted" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SourceCredential_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SourceCredential_orgId_provider_host_key" ON "SourceCredential"("orgId", "provider", "host");
CREATE INDEX "SourceCredential_orgId_idx" ON "SourceCredential"("orgId");
ALTER TABLE "SourceCredential" ADD CONSTRAINT "SourceCredential_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
