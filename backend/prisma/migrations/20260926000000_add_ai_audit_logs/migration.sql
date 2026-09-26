-- CreateTable
CREATE TABLE "ai_audit_logs" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "toolName" TEXT NOT NULL,
    "inputParams" JSONB,
    "resultStatus" TEXT NOT NULL,
    "errorCode" TEXT,
    "durationMs" INTEGER NOT NULL,
    "requestId" TEXT,
    "clientInfo" TEXT,

    CONSTRAINT "ai_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_audit_logs_timestamp_idx" ON "ai_audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "ai_audit_logs_toolName_idx" ON "ai_audit_logs"("toolName");
