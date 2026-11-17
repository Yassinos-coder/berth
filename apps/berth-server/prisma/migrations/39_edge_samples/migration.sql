-- CreateTable
CREATE TABLE "EdgeSample" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "requests" INTEGER NOT NULL,
    "errors4xx" INTEGER NOT NULL DEFAULT 0,
    "errors5xx" INTEGER NOT NULL DEFAULT 0,
    "p95Ms" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EdgeSample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EdgeSample_serviceId_ts_idx" ON "EdgeSample"("serviceId", "ts");

-- CreateIndex
CREATE INDEX "EdgeSample_ts_idx" ON "EdgeSample"("ts");

-- AddForeignKey
ALTER TABLE "EdgeSample" ADD CONSTRAINT "EdgeSample_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
