-- CreateEnum
CREATE TYPE "IdeaStatus" AS ENUM ('CAPTURED', 'PITCHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Idea" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source" TEXT,
    "status" "IdeaStatus" NOT NULL DEFAULT 'CAPTURED',
    "projectId" TEXT NOT NULL,
    "pitchId" TEXT,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Idea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Idea_pitchId_key" ON "Idea"("pitchId");
CREATE INDEX "Idea_projectId_status_createdAt_idx" ON "Idea"("projectId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
