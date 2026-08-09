CREATE TYPE "JobRunStatus" AS ENUM ('queued', 'running', 'success', 'failed');

CREATE TABLE "ScheduledJob" (
  "id" TEXT NOT NULL, "orgId" TEXT NOT NULL, "serviceId" TEXT NOT NULL,
  "name" TEXT NOT NULL, "command" TEXT[], "cron" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'UTC', "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastRunAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ScheduledJob_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "JobRun" (
  "id" TEXT NOT NULL, "orgId" TEXT NOT NULL, "serviceId" TEXT NOT NULL,
  "jobId" TEXT, "command" TEXT[], "status" "JobRunStatus" NOT NULL DEFAULT 'queued',
  "output" TEXT NOT NULL DEFAULT '', "exitCode" INTEGER, "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ScheduledJob_orgId_idx" ON "ScheduledJob"("orgId");
CREATE INDEX "ScheduledJob_serviceId_idx" ON "ScheduledJob"("serviceId");
CREATE INDEX "ScheduledJob_enabled_idx" ON "ScheduledJob"("enabled");
CREATE INDEX "JobRun_orgId_idx" ON "JobRun"("orgId");
CREATE INDEX "JobRun_serviceId_idx" ON "JobRun"("serviceId");
CREATE INDEX "JobRun_jobId_idx" ON "JobRun"("jobId");
ALTER TABLE "ScheduledJob" ADD CONSTRAINT "ScheduledJob_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduledJob" ADD CONSTRAINT "ScheduledJob_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobRun" ADD CONSTRAINT "JobRun_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobRun" ADD CONSTRAINT "JobRun_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobRun" ADD CONSTRAINT "JobRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ScheduledJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
