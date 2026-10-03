-- AlterTable
ALTER TABLE "Pitch" ADD COLUMN     "impact" TEXT,
ADD COLUMN     "problem" TEXT,
ADD COLUMN     "risks" TEXT,
ADD COLUMN     "solution" TEXT;

-- CreateTable
CREATE TABLE "PitchTaskSuggestion" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "acceptanceCriteria" TEXT,
    "role" "EmployeeRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pitchId" TEXT NOT NULL,

    CONSTRAINT "PitchTaskSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PitchTaskSuggestion_pitchId_idx" ON "PitchTaskSuggestion"("pitchId");

-- AddForeignKey
ALTER TABLE "PitchTaskSuggestion" ADD CONSTRAINT "PitchTaskSuggestion_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
