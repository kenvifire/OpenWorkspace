-- CreateTable
CREATE TABLE "ProjectPlanningAgent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "customPrompt" TEXT,
    "activeVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectPlanningAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningAgentVersion" (
    "id" TEXT NOT NULL,
    "planningAgentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "label" TEXT,
    "customPrompt" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanningAgentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPlanningAgent_projectId_key" ON "ProjectPlanningAgent"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectPlanningAgent" ADD CONSTRAINT "ProjectPlanningAgent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningAgentVersion" ADD CONSTRAINT "PlanningAgentVersion_planningAgentId_fkey" FOREIGN KEY ("planningAgentId") REFERENCES "ProjectPlanningAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
