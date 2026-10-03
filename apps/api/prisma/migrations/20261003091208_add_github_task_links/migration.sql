-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "branchName" TEXT,
ADD COLUMN     "githubIssueNumber" INTEGER,
ADD COLUMN     "githubIssueUrl" TEXT,
ADD COLUMN     "pullRequestNumber" INTEGER,
ADD COLUMN     "pullRequestUrl" TEXT;
