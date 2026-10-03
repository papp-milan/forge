/*
  Warnings:

  - Added the required column `projectId` to the `Pitch` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Pitch" ADD COLUMN     "projectId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Pitch" ADD CONSTRAINT "Pitch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
