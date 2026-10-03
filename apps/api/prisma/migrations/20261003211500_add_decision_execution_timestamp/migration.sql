ALTER TABLE "AgentDecision" ADD COLUMN "executionStartedAt" TIMESTAMP(3);
CREATE INDEX "AgentDecision_status_executionStartedAt_idx" ON "AgentDecision"("status","executionStartedAt");
