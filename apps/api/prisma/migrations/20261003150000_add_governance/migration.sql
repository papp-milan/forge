-- CreateEnum
CREATE TYPE "GovernanceDomain" AS ENUM ('ARCHITECTURE', 'PRIVACY', 'SECURITY', 'INFRASTRUCTURE', 'COST');

-- CreateEnum
CREATE TYPE "GovernanceReviewStatus" AS ENUM ('OPEN', 'DEBATING', 'RECOMMENDED', 'REQUIRES_HUMAN_REVIEW', 'RESOLVED');

-- CreateEnum
CREATE TYPE "GovernanceOpinionStance" AS ENUM ('SUPPORT', 'OPPOSE', 'CONDITIONAL', 'ABSTAIN');

-- CreateTable
CREATE TABLE "GovernanceReview" (
    "id" TEXT NOT NULL,
    "domain" "GovernanceDomain" NOT NULL,
    "status" "GovernanceReviewStatus" NOT NULL DEFAULT 'OPEN',
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT,
    "title" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "recommendation" TEXT,
    "dissent" TEXT,
    "requiresHumanReview" BOOLEAN NOT NULL DEFAULT false,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernanceReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GovernanceOpinion" (
    "id" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "stance" "GovernanceOpinionStance" NOT NULL,
    "rationale" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "reviewId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovernanceOpinion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GovernanceFinding" (
    "id" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "remediation" TEXT,
    "reviewId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovernanceFinding_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GovernanceReview_projectId_createdAt_idx" ON "GovernanceReview"("projectId", "createdAt");
CREATE INDEX "GovernanceReview_status_createdAt_idx" ON "GovernanceReview"("status", "createdAt");
CREATE INDEX "GovernanceReview_domain_createdAt_idx" ON "GovernanceReview"("domain", "createdAt");
CREATE INDEX "GovernanceOpinion_reviewId_round_idx" ON "GovernanceOpinion"("reviewId", "round");
CREATE INDEX "GovernanceFinding_reviewId_idx" ON "GovernanceFinding"("reviewId");

ALTER TABLE "GovernanceReview" ADD CONSTRAINT "GovernanceReview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GovernanceOpinion" ADD CONSTRAINT "GovernanceOpinion_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "GovernanceReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GovernanceFinding" ADD CONSTRAINT "GovernanceFinding_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "GovernanceReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
