-- CreateEnum
CREATE TYPE "SupportSenderType" AS ENUM ('CUSTOMER', 'STAFF', 'AI');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportDeliveryStatus" AS ENUM ('PERSISTED', 'DELIVERED', 'READ');

-- CreateTable
CREATE TABLE "SupportChannel" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "kind" VARCHAR(32) NOT NULL DEFAULT 'WEB',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "customerUserId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "lastSequence" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "senderType" "SupportSenderType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastReadSequence" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderParticipantId" TEXT NOT NULL,
    "senderType" "SupportSenderType" NOT NULL,
    "channel" VARCHAR(32) NOT NULL DEFAULT 'WEB',
    "sequence" INTEGER NOT NULL,
    "content" VARCHAR(4000) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'SENT',
    "clientKey" VARCHAR(128) NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationAssignment" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "ConversationAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationEvent" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" VARCHAR(32) NOT NULL,
    "version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageDelivery" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "status" "SupportDeliveryStatus" NOT NULL DEFAULT 'PERSISTED',
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),

    CONSTRAINT "MessageDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportChannel_tenant_id_id_key" ON "SupportChannel"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SupportChannel_tenant_id_kind_key" ON "SupportChannel"("tenant_id", "kind");

-- CreateIndex
CREATE INDEX "Conversation_tenant_id_status_updatedAt_idx" ON "Conversation"("tenant_id", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Conversation_customerUserId_updatedAt_idx" ON "Conversation"("customerUserId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_tenant_id_id_key" ON "Conversation"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_tenant_id_channelId_customerUserId_key" ON "Conversation"("tenant_id", "channelId", "customerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_tenant_id_conversationId_id_key" ON "ConversationParticipant"("tenant_id", "conversationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_tenant_id_conversationId_userId_sen_key" ON "ConversationParticipant"("tenant_id", "conversationId", "userId", "senderType");

-- CreateIndex
CREATE UNIQUE INDEX "Message_tenant_id_conversationId_id_key" ON "Message"("tenant_id", "conversationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Message_tenant_id_conversationId_sequence_key" ON "Message"("tenant_id", "conversationId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Message_tenant_id_conversationId_senderParticipantId_client_key" ON "Message"("tenant_id", "conversationId", "senderParticipantId", "clientKey");

-- CreateIndex
CREATE INDEX "ConversationAssignment_tenant_id_conversationId_endedAt_idx" ON "ConversationAssignment"("tenant_id", "conversationId", "endedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationEvent_tenant_id_conversationId_version_key" ON "ConversationEvent"("tenant_id", "conversationId", "version");

-- CreateIndex
CREATE INDEX "MessageDelivery_tenant_id_conversationId_participantId_stat_idx" ON "MessageDelivery"("tenant_id", "conversationId", "participantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MessageDelivery_tenant_id_messageId_participantId_key" ON "MessageDelivery"("tenant_id", "messageId", "participantId");

-- AddForeignKey
ALTER TABLE "SupportChannel" ADD CONSTRAINT "SupportChannel_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_tenant_id_channelId_fkey" FOREIGN KEY ("tenant_id", "channelId") REFERENCES "SupportChannel"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_tenant_id_contactId_fkey" FOREIGN KEY ("tenant_id", "contactId") REFERENCES "Customer"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_tenant_id_conversationId_fkey" FOREIGN KEY ("tenant_id", "conversationId") REFERENCES "Conversation"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_tenant_id_conversationId_fkey" FOREIGN KEY ("tenant_id", "conversationId") REFERENCES "Conversation"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_tenant_id_conversationId_senderParticipantId_fkey" FOREIGN KEY ("tenant_id", "conversationId", "senderParticipantId") REFERENCES "ConversationParticipant"("tenant_id", "conversationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationAssignment" ADD CONSTRAINT "ConversationAssignment_tenant_id_conversationId_fkey" FOREIGN KEY ("tenant_id", "conversationId") REFERENCES "Conversation"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationAssignment" ADD CONSTRAINT "ConversationAssignment_assigneeId_tenant_id_fkey" FOREIGN KEY ("assigneeId", "tenant_id") REFERENCES "Membership"("userId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationEvent" ADD CONSTRAINT "ConversationEvent_tenant_id_conversationId_fkey" FOREIGN KEY ("tenant_id", "conversationId") REFERENCES "Conversation"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_tenant_id_conversationId_messageId_fkey" FOREIGN KEY ("tenant_id", "conversationId", "messageId") REFERENCES "Message"("tenant_id", "conversationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_tenant_id_conversationId_participantId_fkey" FOREIGN KEY ("tenant_id", "conversationId", "participantId") REFERENCES "ConversationParticipant"("tenant_id", "conversationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


CREATE UNIQUE INDEX "ConversationAssignment_one_current" ON "ConversationAssignment" (tenant_id, "conversationId") WHERE "endedAt" IS NULL;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_valid_sequence" CHECK ("lastSequence" >= 0 AND version > 0);
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "Participant_valid_read" CHECK ("lastReadSequence" >= 0);
ALTER TABLE "Message" ADD CONSTRAINT "Message_valid_content" CHECK (sequence > 0 AND length(content) BETWEEN 1 AND 4000 AND status = 'SENT' AND channel = 'WEB');
