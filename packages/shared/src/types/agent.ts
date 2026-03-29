import { AgentType, PricingModel, ProjectRole } from '../enums';

export interface AgentProvider {
  id: string;
  userId: string;
  displayName: string;
  bio?: string;
  createdAt: Date;
}

export interface Agent {
  id: string;
  providerId: string;
  name: string;
  description: string;
  type: AgentType;
  pricingModel: PricingModel;
  pricePerJob?: number;    // in cents, for PER_JOB
  pricePerToken?: number;  // in micro-cents, for PER_TOKEN
  capabilityTags: string[];
  isPublished: boolean;
  aggregateRating?: number;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectAgent {
  id: string;
  projectId: string;
  agentId: string;
  role: ProjectRole;
  customRole?: string;
  isCoordinator: boolean;
  hiredAt: Date;
  hiredById: string;
}

export interface AgentReview {
  id: string;
  agentId: string;
  projectId: string;
  reviewerId: string;
  rating: number;        // 1–5
  comment?: string;
  providerResponse?: string;
  createdAt: Date;
}
