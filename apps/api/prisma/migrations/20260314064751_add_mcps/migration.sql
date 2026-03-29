-- CreateEnum
CREATE TYPE "McpTransport" AS ENUM ('SSE', 'HTTP', 'STDIO');

-- CreateTable
CREATE TABLE "Mcp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "transport" "McpTransport" NOT NULL DEFAULT 'SSE',
    "url" TEXT,
    "command" TEXT,
    "args" TEXT[],
    "headers" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mcp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMcp" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "mcpId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentMcp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentMcp_agentId_mcpId_key" ON "AgentMcp"("agentId", "mcpId");

-- AddForeignKey
ALTER TABLE "Mcp" ADD CONSTRAINT "Mcp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMcp" ADD CONSTRAINT "AgentMcp_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMcp" ADD CONSTRAINT "AgentMcp_mcpId_fkey" FOREIGN KEY ("mcpId") REFERENCES "Mcp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
