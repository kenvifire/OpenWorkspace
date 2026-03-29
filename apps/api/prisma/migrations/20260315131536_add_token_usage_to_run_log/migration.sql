-- AlterTable
ALTER TABLE "AgentRunLog" ADD COLUMN     "totalInputTokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalOutputTokens" INTEGER NOT NULL DEFAULT 0;
