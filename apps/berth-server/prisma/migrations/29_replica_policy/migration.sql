ALTER TABLE "Service" ADD COLUMN "replicaPolicy" JSONB;
ALTER TABLE "Service" ADD COLUMN "lastReplicaScaleAt" TIMESTAMP(3);
