import { AgentType, PricingModel } from '../enums';

export interface MarketplaceFilters {
  type?: AgentType;
  pricingModel?: PricingModel;
  capabilityTags?: string[];
  minRating?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
