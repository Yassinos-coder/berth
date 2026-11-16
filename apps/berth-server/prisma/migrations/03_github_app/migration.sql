-- GitHub App credentials created via the App Manifest flow (single row, secrets encrypted at rest)
CREATE TABLE "GithubApp" (
  "id" TEXT NOT NULL,
  "appId" INTEGER NOT NULL,
  "slug" TEXT NOT NULL,
  "clientId" TEXT NOT NULL DEFAULT '',
  "clientSecret" TEXT NOT NULL DEFAULT '',
  "webhookSecret" TEXT NOT NULL,
  "privateKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GithubApp_pkey" PRIMARY KEY ("id")
);
