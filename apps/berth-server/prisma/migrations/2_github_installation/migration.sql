-- GitHub App installation per organization
CREATE TABLE "GithubInstallation" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "installationId" INTEGER NOT NULL,
  "accountLogin" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GithubInstallation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GithubInstallation_orgId_key" ON "GithubInstallation"("orgId");
CREATE UNIQUE INDEX "GithubInstallation_installationId_key" ON "GithubInstallation"("installationId");
ALTER TABLE "GithubInstallation" ADD CONSTRAINT "GithubInstallation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
