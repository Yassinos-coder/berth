-- Friendly internal hostnames (extra Docker network aliases) per service
ALTER TABLE "Service" ADD COLUMN "internalDomains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
