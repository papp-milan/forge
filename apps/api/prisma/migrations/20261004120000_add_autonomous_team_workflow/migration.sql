-- CreateEnum
CREATE TYPE "TaskRisk" AS ENUM ('SMALL', 'LARGE');

-- CreateEnum
CREATE TYPE "ReleasePolicy" AS ENUM ('CEO_APPROVAL', 'AUTONOMOUS');

-- CreateEnum
CREATE TYPE "AgentCommunicationStatus" AS ENUM ('UNREAD', 'READ', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "AgentCommunicationKind" AS ENUM ('HANDOFF', 'FEEDBACK', 'DISPUTE', 'ESCALATION', 'DECISION', 'STATUS');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "risk" "TaskRisk" NOT NULL DEFAULT 'SMALL';

-- AlterTable
ALTER TABLE "Feature" ADD COLUMN "releasePolicy" "ReleasePolicy" NOT NULL DEFAULT 'CEO_APPROVAL';

-- AlterTable
ALTER TABLE "AgentRun"
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
  ADD COLUMN "retryable" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "failureClass" TEXT;

-- AlterTable
ALTER TABLE "AgentArtifact"
  ADD COLUMN "projectId" TEXT,
  ADD COLUMN "taskId" TEXT;

-- CreateTable
CREATE TABLE "AgentCommunication" (
  "id" TEXT NOT NULL,
  "fromAgent" TEXT NOT NULL,
  "toAgent" TEXT NOT NULL,
  "kind" "AgentCommunicationKind" NOT NULL,
  "status" "AgentCommunicationStatus" NOT NULL DEFAULT 'UNREAD',
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "subject" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "correlationId" TEXT,
  "projectId" TEXT,
  "featureId" TEXT,
  "taskId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt" TIMESTAMP(3),
  "acknowledgedAt" TIMESTAMP(3),

  CONSTRAINT "AgentCommunication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubOperation" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "response" JSONB,
  "error" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GithubOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentCommunication_toAgent_status_createdAt_idx" ON "AgentCommunication"("toAgent", "status", "createdAt");
CREATE INDEX "AgentCommunication_fromAgent_createdAt_idx" ON "AgentCommunication"("fromAgent", "createdAt");
CREATE INDEX "AgentCommunication_projectId_createdAt_idx" ON "AgentCommunication"("projectId", "createdAt");
CREATE INDEX "AgentCommunication_taskId_createdAt_idx" ON "AgentCommunication"("taskId", "createdAt");
CREATE INDEX "AgentCommunication_correlationId_idx" ON "AgentCommunication"("correlationId");
CREATE UNIQUE INDEX "GithubOperation_key_key" ON "GithubOperation"("key");
CREATE INDEX "GithubOperation_operation_status_createdAt_idx" ON "GithubOperation"("operation", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "AgentArtifact" ADD CONSTRAINT "AgentArtifact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentArtifact" ADD CONSTRAINT "AgentArtifact_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentCommunication" ADD CONSTRAINT "AgentCommunication_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentCommunication" ADD CONSTRAINT "AgentCommunication_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentCommunication" ADD CONSTRAINT "AgentCommunication_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
