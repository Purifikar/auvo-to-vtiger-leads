-- ============================================================================
-- MIGRATION: Add DLQ and Config Tables
-- ============================================================================
-- Execute this script manually to add new columns and tables
-- without losing existing data.
--
-- To run: psql -h host -U user -d API -f migration_add_dlq.sql
-- Or via a database client like DBeaver/pgAdmin
-- ============================================================================

-- ============================================================================
-- 1. Add new columns to LeadRequest table
-- ============================================================================

-- Add originalPayload column (stores original before any edits)
ALTER TABLE "LeadRequest" 
ADD COLUMN IF NOT EXISTS "originalPayload" TEXT;

-- Add retryCount column with default 0
ALTER TABLE "LeadRequest" 
ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0;

-- Add lastRetryAt column
ALTER TABLE "LeadRequest" 
ADD COLUMN IF NOT EXISTS "lastRetryAt" TIMESTAMP(3);

-- Add source column to track where the lead came from
ALTER TABLE "LeadRequest" 
ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'WEBHOOK';

-- ============================================================================
-- 2. Create indexes for better query performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS "LeadRequest_status_idx" ON "LeadRequest"("status");
CREATE INDEX IF NOT EXISTS "LeadRequest_createdAt_idx" ON "LeadRequest"("createdAt");

-- ============================================================================
-- 3. Create SystemConfig table (Feature Flags)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "SystemConfig" (
    "id" SERIAL PRIMARY KEY,
    "key" TEXT NOT NULL UNIQUE,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "SystemConfig_key_idx" ON "SystemConfig"("key");

-- ============================================================================
-- 4. Create ConfigHistory table (Rollback support)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "ConfigHistory" (
    "id" SERIAL PRIMARY KEY,
    "configKey" TEXT NOT NULL,
    "oldValue" TEXT NOT NULL,
    "newValue" TEXT NOT NULL,
    "changedBy" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ConfigHistory_configKey_idx" ON "ConfigHistory"("configKey");
CREATE INDEX IF NOT EXISTS "ConfigHistory_changedAt_idx" ON "ConfigHistory"("changedAt");

-- ============================================================================
-- 5. Create SystemLog table (Structured logging)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "SystemLog" (
    "id" SERIAL PRIMARY KEY,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" TEXT,
    "response" TEXT,
    "statusCode" INTEGER,
    "source" TEXT NOT NULL,
    "leadId" INTEGER,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "SystemLog_level_idx" ON "SystemLog"("level");
CREATE INDEX IF NOT EXISTS "SystemLog_source_idx" ON "SystemLog"("source");
CREATE INDEX IF NOT EXISTS "SystemLog_leadId_idx" ON "SystemLog"("leadId");
CREATE INDEX IF NOT EXISTS "SystemLog_createdAt_idx" ON "SystemLog"("createdAt");

-- ============================================================================
-- 6. Insert default feature flags
-- ============================================================================

INSERT INTO "SystemConfig" ("key", "value", "type", "description") 
VALUES 
    ('maintenance_mode', 'false', 'boolean', 'Enable maintenance mode - stops all processing'),
    ('pilot_mode', 'true', 'boolean', 'Enable pilot mode - only process pilot users'),
    ('auvo_integration_active', 'true', 'boolean', 'Enable/disable Auvo integration'),
    ('vtiger_integration_active', 'true', 'boolean', 'Enable/disable VTiger integration'),
    ('max_retry_count', '3', 'number', 'Maximum retry attempts for failed leads')
ON CONFLICT ("key") DO NOTHING;

-- ============================================================================
-- Verify migration
-- ============================================================================

SELECT 'Migration completed successfully!' as result;

-- Check new columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'LeadRequest'
ORDER BY ordinal_position;

-- Check new tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('SystemConfig', 'ConfigHistory', 'SystemLog');
