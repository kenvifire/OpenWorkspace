-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "coordinatorProjectAgentId" TEXT;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_coordinatorProjectAgentId_fkey" FOREIGN KEY ("coordinatorProjectAgentId") REFERENCES "ProjectAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
