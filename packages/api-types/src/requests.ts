import type { LlmProvider, ProjectRole, TaskPriority, TaskStatus } from "./models"

// ─── Workspaces ───────────────────────────────────────────────────────────────

export interface CreateWorkspaceDto {
  name: string
  slug: string
}

export interface InviteMemberDto {
  email: string
  role: "OWNER" | "MEMBER"
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export interface CreateProjectDto {
  name: string
  description: string
}

export interface UpdateProjectDto {
  name?: string
  description?: string
}

export interface HireAgentDto {
  agentId: string
  role: ProjectRole
  customRole?: string
  isCoordinator?: boolean
}

export interface AcceptAgreementDto {
  signatureRef?: string
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export interface CreateTaskDto {
  title: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  assigneeId?: string
  dueDate?: string
}

export interface UpdateTaskDto {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  assigneeId?: string | null
  dueDate?: string | null
}

// ─── Keys ─────────────────────────────────────────────────────────────────────

export interface CreateResourceKeyDto {
  name: string
  description?: string
  value: string
}

// ─── Workspace Provider Keys ──────────────────────────────────────────────────

export interface UpsertProviderKeyDto {
  provider: LlmProvider
  apiKey: string
  label?: string
}

// ─── Planner ──────────────────────────────────────────────────────────────────

export interface SetPlannerDto {
  projectAgentId: string
}

export interface AcceptPlanDto {
  roles: Array<{ name: string; description?: string }>
  tasks: Array<{ title: string; role: string; priority?: string; description?: string; assigneeId?: string; dependencies?: string[] }>
  replaceExisting?: boolean
}

// ─── Agents / Providers ───────────────────────────────────────────────────────

export interface RegisterProviderDto {
  displayName: string
  bio?: string
}

export interface CreateAgentDto {
  name: string
  description: string
  type: "AI" | "HUMAN"
  pricingModel: "PER_JOB" | "PER_TOKEN"
  pricePerJob?: number
  pricePerToken?: number
  capabilityTags?: string[]
  // LLM config
  llmProvider?: LlmProvider
  modelName?: string
  systemPrompt?: string
  apiKey?: string
  temperature?: number
  maxTokens?: number
  maxIterations?: number
  enabledTools?: string[]
}

export interface UpdateAgentDto extends Partial<CreateAgentDto> {}

// ─── Billing ──────────────────────────────────────────────────────────────────

export interface CreateCheckoutDto {
  amountCents: number
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

export interface CreateReviewDto {
  rating: number
  comment?: string
}

// ─── Marketplace ──────────────────────────────────────────────────────────────

export interface MarketplaceSearchParams {
  q?: string
  tags?: string
  type?: "AI" | "HUMAN"
  pricingModel?: "PER_JOB" | "PER_TOKEN"
  minRating?: number
  page?: number
  limit?: number
}
