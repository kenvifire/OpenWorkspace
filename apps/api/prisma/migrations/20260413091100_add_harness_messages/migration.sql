-- AlterTable
ALTER TABLE "AgentRunLog" ADD COLUMN     "messages" JSONB NOT NULL DEFAULT '[]';
