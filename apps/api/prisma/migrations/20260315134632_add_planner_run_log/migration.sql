-- CreateTable
CREATE TABLE "PlannerRunLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "descriptionSnapshot" TEXT,
    "planOutput" JSONB,
    "error" TEXT,
    "totalInputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalOutputTokens" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "PlannerRunLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlannerRunLog_projectId_startedAt_idx" ON "PlannerRunLog"("projectId", "startedAt");

-- AddForeignKey
ALTER TABLE "PlannerRunLog" ADD CONSTRAINT "PlannerRunLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
