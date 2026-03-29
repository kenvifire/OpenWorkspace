-- CreateTable
CREATE TABLE "ProjectAgentSkill" (
    "id" TEXT NOT NULL,
    "projectAgentId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectAgentSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAgentMcp" (
    "id" TEXT NOT NULL,
    "projectAgentId" TEXT NOT NULL,
    "mcpId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectAgentMcp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAgentSkill_projectAgentId_skillId_key" ON "ProjectAgentSkill"("projectAgentId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAgentMcp_projectAgentId_mcpId_key" ON "ProjectAgentMcp"("projectAgentId", "mcpId");

-- AddForeignKey
ALTER TABLE "ProjectAgentSkill" ADD CONSTRAINT "ProjectAgentSkill_projectAgentId_fkey" FOREIGN KEY ("projectAgentId") REFERENCES "ProjectAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAgentSkill" ADD CONSTRAINT "ProjectAgentSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAgentMcp" ADD CONSTRAINT "ProjectAgentMcp_projectAgentId_fkey" FOREIGN KEY ("projectAgentId") REFERENCES "ProjectAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAgentMcp" ADD CONSTRAINT "ProjectAgentMcp_mcpId_fkey" FOREIGN KEY ("mcpId") REFERENCES "Mcp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
