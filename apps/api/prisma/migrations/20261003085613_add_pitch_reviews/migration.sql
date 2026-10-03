-- CreateEnum
CREATE TYPE "PitchReviewAction" AS ENUM ('APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

-- CreateTable
CREATE TABLE "PitchReview" (
    "id" TEXT NOT NULL,
    "action" "PitchReviewAction" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pitchId" TEXT NOT NULL,

    CONSTRAINT "PitchReview_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PitchReview" ADD CONSTRAINT "PitchReview_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
