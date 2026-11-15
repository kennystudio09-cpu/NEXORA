-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "aiGeneration" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "aiHumanRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aiState" VARCHAR(32) NOT NULL DEFAULT 'HUMAN';

-- AlterTable
ALTER TABLE "ConversationParticipant" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "citations" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "AIAgent" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL DEFAULT 'NEXORA Assistant',
    "welcome" VARCHAR(300) NOT NULL DEFAULT '',
    "tone" VARCHAR(20) NOT NULL DEFAULT 'PROFESSIONAL',
    "language" VARCHAR(2) NOT NULL DEFAULT 'en',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIAgentVersion" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" VARCHAR(32) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIAgentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AISettings" (
    "tenant_id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "autoReply" BOOLEAN NOT NULL DEFAULT false,
    "mode" VARCHAR(20) NOT NULL DEFAULT 'HUMAN_FIRST',
    "tokenQuota" INTEGER NOT NULL DEFAULT 100000,
    "requestsPerMinute" INTEGER NOT NULL DEFAULT 10,
    "period" VARCHAR(7) NOT NULL DEFAULT '',
    "usedTokens" INTEGER NOT NULL DEFAULT 0,
    "reservedTokens" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AISettings_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "AIUsageRecord" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentRevision" INTEGER NOT NULL,
    "conversationId" TEXT,
    "triggerMessageId" TEXT,
    "actorId" TEXT NOT NULL,
    "requestKey" VARCHAR(128) NOT NULL,
    "kind" VARCHAR(16) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "reason" VARCHAR(40) NOT NULL DEFAULT '',
    "provider" VARCHAR(32) NOT NULL DEFAULT 'openai',
    "model" VARCHAR(80) NOT NULL,
    "promptHash" VARCHAR(64) NOT NULL,
    "language" VARCHAR(2) NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "reservedTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DECIMAL(18,8),
    "usageKnown" BOOLEAN NOT NULL DEFAULT false,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AIUsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeBase" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL DEFAULT 'Support',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeBase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "baseId" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "questions" JSONB NOT NULL,
    "answers" JSONB NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "language" VARCHAR(2) NOT NULL,
    "searchText" VARCHAR(2000) NOT NULL,
    "answer" VARCHAR(2000) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AIAgent_tenant_id_key" ON "AIAgent"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "AIAgent_tenant_id_id_key" ON "AIAgent"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AIAgentVersion_tenant_id_agentId_revision_key" ON "AIAgentVersion"("tenant_id", "agentId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "AISettings_agentId_key" ON "AISettings"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "AISettings_tenant_id_agentId_key" ON "AISettings"("tenant_id", "agentId");

-- CreateIndex
CREATE INDEX "AIUsageRecord_status_createdAt_idx" ON "AIUsageRecord"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AIUsageRecord_tenant_id_id_key" ON "AIUsageRecord"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AIUsageRecord_tenant_id_triggerMessageId_key" ON "AIUsageRecord"("tenant_id", "triggerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "AIUsageRecord_tenant_id_actorId_requestKey_key" ON "AIUsageRecord"("tenant_id", "actorId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeBase_tenant_id_id_key" ON "KnowledgeBase"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeBase_tenant_id_name_key" ON "KnowledgeBase"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_tenant_id_status_idx" ON "KnowledgeDocument"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDocument_tenant_id_id_key" ON "KnowledgeDocument"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_tenant_id_active_language_idx" ON "KnowledgeChunk"("tenant_id", "active", "language");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeChunk_tenant_id_documentId_revision_language_key" ON "KnowledgeChunk"("tenant_id", "documentId", "revision", "language");

-- AddForeignKey
ALTER TABLE "AIAgent" ADD CONSTRAINT "AIAgent_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAgentVersion" ADD CONSTRAINT "AIAgentVersion_tenant_id_agentId_fkey" FOREIGN KEY ("tenant_id", "agentId") REFERENCES "AIAgent"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AISettings" ADD CONSTRAINT "AISettings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AISettings" ADD CONSTRAINT "AISettings_tenant_id_agentId_fkey" FOREIGN KEY ("tenant_id", "agentId") REFERENCES "AIAgent"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsageRecord" ADD CONSTRAINT "AIUsageRecord_tenant_id_agentId_fkey" FOREIGN KEY ("tenant_id", "agentId") REFERENCES "AIAgent"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsageRecord" ADD CONSTRAINT "AIUsageRecord_tenant_id_conversationId_fkey" FOREIGN KEY ("tenant_id", "conversationId") REFERENCES "Conversation"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsageRecord" ADD CONSTRAINT "AIUsageRecord_tenant_id_conversationId_triggerMessageId_fkey" FOREIGN KEY ("tenant_id", "conversationId", "triggerMessageId") REFERENCES "Message"("tenant_id", "conversationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeBase" ADD CONSTRAINT "KnowledgeBase_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_tenant_id_baseId_fkey" FOREIGN KEY ("tenant_id", "baseId") REFERENCES "KnowledgeBase"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_tenant_id_documentId_fkey" FOREIGN KEY ("tenant_id", "documentId") REFERENCES "KnowledgeDocument"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


CREATE UNIQUE INDEX "Participant_one_ai" ON "ConversationParticipant" (tenant_id,"conversationId") WHERE "senderType" = 'AI';
ALTER TABLE "AISettings" ADD CONSTRAINT "AISettings_budget" CHECK ("tokenQuota" BETWEEN 1000 AND 10000000 AND "usedTokens">=0 AND "reservedTokens">=0 AND "requestsPerMinute" BETWEEN 1 AND 60);
