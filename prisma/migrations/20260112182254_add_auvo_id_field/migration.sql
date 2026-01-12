-- CreateTable
CREATE TABLE "LeadRequest" (
    "id" SERIAL NOT NULL,
    "auvoId" INTEGER,
    "payload" TEXT NOT NULL,
    "originalPayload" TEXT,
    "status" TEXT NOT NULL,
    "vtigerId" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetryAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'WEBHOOK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigHistory" (
    "id" SERIAL NOT NULL,
    "configKey" TEXT NOT NULL,
    "oldValue" TEXT NOT NULL,
    "newValue" TEXT NOT NULL,
    "changedBy" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" SERIAL NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" TEXT,
    "response" TEXT,
    "statusCode" INTEGER,
    "source" TEXT NOT NULL,
    "leadId" INTEGER,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeadRequest_auvoId_key" ON "LeadRequest"("auvoId");

-- CreateIndex
CREATE INDEX "LeadRequest_status_idx" ON "LeadRequest"("status");

-- CreateIndex
CREATE INDEX "LeadRequest_createdAt_idx" ON "LeadRequest"("createdAt");

-- CreateIndex
CREATE INDEX "LeadRequest_auvoId_idx" ON "LeadRequest"("auvoId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");

-- CreateIndex
CREATE INDEX "SystemConfig_key_idx" ON "SystemConfig"("key");

-- CreateIndex
CREATE INDEX "ConfigHistory_configKey_idx" ON "ConfigHistory"("configKey");

-- CreateIndex
CREATE INDEX "ConfigHistory_changedAt_idx" ON "ConfigHistory"("changedAt");

-- CreateIndex
CREATE INDEX "SystemLog_level_idx" ON "SystemLog"("level");

-- CreateIndex
CREATE INDEX "SystemLog_source_idx" ON "SystemLog"("source");

-- CreateIndex
CREATE INDEX "SystemLog_leadId_idx" ON "SystemLog"("leadId");

-- CreateIndex
CREATE INDEX "SystemLog_createdAt_idx" ON "SystemLog"("createdAt");
