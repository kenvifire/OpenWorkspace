import { BillingEvent, PricingModel } from '../enums';

export interface BillingRecord {
  id: string;
  workspaceId: string;
  projectId: string;
  projectAgentId: string;
  event: BillingEvent;
  pricingModel: PricingModel;
  amountCents: number;
  tokenCount?: number;
  description: string;
  createdAt: Date;
}

export interface BillingCycleSummary {
  workspaceId: string;
  periodStart: Date;
  periodEnd: Date;
  totalCents: number;
  byProject: Array<{
    projectId: string;
    projectName: string;
    totalCents: number;
    byAgent: Array<{
      agentId: string;
      agentName: string;
      totalCents: number;
    }>;
  }>;
}
