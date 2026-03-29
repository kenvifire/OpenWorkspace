-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'STOPPED', 'FAILED', 'MAX_ITERATIONS');

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "enabledTools" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "encryptedApiKey" TEXT,
ADD COLUMN     "llmProvider" TEXT,
ADD COLUMN     "maxIterations" INTEGER DEFAULT 20,
ADD COLUMN     "maxTokens" INTEGER,
ADD COLUMN     "modelName" TEXT,
ADD COLUMN     "systemPrompt" TEXT,
ADD COLUMN     "temperature" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "plannerProjectAgentId" TEXT;

-- CreateTable
CREATE TABLE "WorkspaceProviderKey" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "label" TEXT,
    "encryptedKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceProviderKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRunLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "projectAgentId" TEXT NOT NULL,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'RUNNING',
    "iterations" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "log" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "AgentRunLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceProviderKey_workspaceId_provider_key" ON "WorkspaceProviderKey"("workspaceId", "provider");

-- CreateIndex
CREATE INDEX "AgentRunLog_taskId_idx" ON "AgentRunLog"("taskId");

-- CreateIndex
CREATE INDEX "AgentRunLog_agentId_idx" ON "AgentRunLog"("agentId");

-- CreateIndex
CREATE INDEX "AgentRunLog_projectAgentId_idx" ON "AgentRunLog"("projectAgentId");

-- AddForeignKey
ALTER TABLE "WorkspaceProviderKey" ADD CONSTRAINT "WorkspaceProviderKey_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_plannerProjectAgentId_fkey" FOREIGN KEY ("plannerProjectAgentId") REFERENCES "ProjectAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRunLog" ADD CONSTRAINT "AgentRunLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRunLog" ADD CONSTRAINT "AgentRunLog_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRunLog" ADD CONSTRAINT "AgentRunLog_projectAgentId_fkey" FOREIGN KEY ("projectAgentId") REFERENCES "ProjectAgent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "User_clerkId_key" RENAME TO "User_firebaseUid_key";
