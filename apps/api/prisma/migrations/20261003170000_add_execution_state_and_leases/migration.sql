-- Add durable execution state and distributed runtime leases.
ALTER TYPE "AgentDecisionStatus" ADD VALUE IF NOT EXISTS 'EXECUTING';

CREATE TABLE "RuntimeLease" (
  "key" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RuntimeLease_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "RuntimeLease_expiresAt_idx" ON "RuntimeLease"("expiresAt");
