CREATE TABLE "MetricSample" (
  "id" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "ts" TIMESTAMP(3) NOT NULL,
  "cpuPct" DOUBLE PRECISION NOT NULL,
  "memMb" DOUBLE PRECISION NOT NULL,
  "netRxMb" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "netTxMb" DOUBLE PRECISION NOT NULL DEFAULT 0,
  CONSTRAINT "MetricSample_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MetricSample_serviceId_ts_idx" ON "MetricSample"("serviceId", "ts");
CREATE INDEX "MetricSample_ts_idx" ON "MetricSample"("ts");

ALTER TABLE "MetricSample" ADD CONSTRAINT "MetricSample_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
