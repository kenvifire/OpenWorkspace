-- DropForeignKey
ALTER TABLE "Agent" DROP CONSTRAINT "Agent_providerId_fkey";

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "providerId" DROP NOT NULL,
ALTER COLUMN "type" SET DEFAULT 'AI',
ALTER COLUMN "pricingModel" SET DEFAULT 'PER_JOB',
ALTER COLUMN "capabilityTags" SET DEFAULT ARRAY[]::TEXT[];

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "AgentProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
