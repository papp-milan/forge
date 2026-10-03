-- Add persistent runtime session, message, tool-call, artifact and usage records.
CREATE TABLE "AgentSession" (
  "id" TEXT NOT NULL,
  "agent" TEXT NOT NULL,
  "runtime" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "projectId" TEXT,
  "taskId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentSession_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AgentMessage" (
  "id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "sequence" INTEGER NOT NULL,
  "sessionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentMessage_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AgentToolCall" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "input" JSONB,
  "output" JSONB,
  "error" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "sessionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentToolCall_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AgentArtifact" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "uri" TEXT,
  "checksum" TEXT,
  "metadata" JSONB,
  "sessionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentArtifact_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AgentUsage" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "cachedTokens" INTEGER NOT NULL DEFAULT 0,
  "costUsd" DECIMAL(12,6) NOT NULL DEFAULT 0,
  "sessionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentUsage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AgentMessage_sessionId_sequence_key" ON "AgentMessage"("sessionId","sequence");
CREATE UNIQUE INDEX "AgentUsage_sessionId_key" ON "AgentUsage"("sessionId");
CREATE INDEX "AgentSession_projectId_createdAt_idx" ON "AgentSession"("projectId","createdAt");
CREATE INDEX "AgentSession_taskId_createdAt_idx" ON "AgentSession"("taskId","createdAt");
CREATE INDEX "AgentSession_agent_status_createdAt_idx" ON "AgentSession"("agent","status","createdAt");
CREATE INDEX "AgentMessage_sessionId_createdAt_idx" ON "AgentMessage"("sessionId","createdAt");
CREATE INDEX "AgentToolCall_sessionId_createdAt_idx" ON "AgentToolCall"("sessionId","createdAt");
CREATE INDEX "AgentToolCall_status_createdAt_idx" ON "AgentToolCall"("status","createdAt");
CREATE INDEX "AgentArtifact_sessionId_createdAt_idx" ON "AgentArtifact"("sessionId","createdAt");
ALTER TABLE "AgentSession" ADD CONSTRAINT "AgentSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentSession" ADD CONSTRAINT "AgentSession_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AgentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentToolCall" ADD CONSTRAINT "AgentToolCall_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AgentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentArtifact" ADD CONSTRAINT "AgentArtifact_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AgentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentUsage" ADD CONSTRAINT "AgentUsage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AgentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
