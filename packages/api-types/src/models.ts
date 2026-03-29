// ─── Enums ────────────────────────────────────────────────────────────────────

export type WorkspaceMemberRole = "OWNER" | "MEMBER"

export type ProjectRole =
  | "LEADER"
  | "COORDINATOR"
  | "DEVELOPER"
  | "REVIEWER"
  | "DESIGNER"
  | "QA"
  | "CUSTOM"

export type TaskStatus = "BACKLOG" | "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE"

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT"

export type AgentType = "AI" | "HUMAN"

export type PricingModel = "PER_JOB" | "PER_TOKEN"

export type AgentRunStatus =
  | "RUNNING"
  | "COMPLETED"
  | "STOPPED"
  | "FAILED"
  | "MAX_ITERATIONS"

export type LlmProvider = "openai" | "anthropic" | "gemini" | "custom"

// ─── Core Models ──────────────────────────────────────────────────────────────

export interface User {
  id: string
  firebaseUid: string
  email: string
  name: string
  avatarUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface Workspace {
  id: string
  name: string
  slug: string
  ownerId: string
  createdAt: string
  updatedAt: string
  _count?: {
    members: number
    projects: number
  }
}

export interface WorkspaceMember {
  id: string
  workspaceId: string
  userId: string
  role: WorkspaceMemberRole
  joinedAt: string
  user?: Pick<User, "id" | "email" | "name" | "avatarUrl">
}

export interface WorkspaceProviderKey {
  id: string
  workspaceId: string
  provider: LlmProvider
  label: string | null
  createdAt: string
  updatedAt: string
  // Note: encryptedKey is never returned to client
}

export interface Project {
  id: string
  workspaceId: string
  name: string
  description: string
  leaderId: string
  plannerProjectAgentId: string | null
  sandboxProvider: string | null
  createdAt: string
  updatedAt: string
  _count?: {
    tasks: number
    projectAgents: number
  }
}

export interface ResourceKey {
  id: string
  projectId: string
  name: string
  description: string | null
  createdAt: string
  createdById: string
}

export interface AgentProvider {
  id: string
  userId: string
  displayName: string
  bio: string | null
  kycVerified: boolean
  kycVerifiedAt: string | null
  activeDpaVersion: string | null
  createdAt: string
}

export interface AgentVersion {
  id: string
  agentId: string
  versionNumber: number
  label: string | null
  name: string
  description: string
  systemPrompt: string | null
  llmProvider: string | null
  modelName: string | null
  temperature: number | null
  maxTokens: number | null
  maxIterations: number | null
  enabledTools: string[]
  publishedAt: string
}

export interface Agent {
  id: string
  providerId: string
  name: string
  description: string
  type: AgentType
  pricingModel: PricingModel
  pricePerJob: number | null
  pricePerToken: number | null
  capabilityTags: string[]
  isPublished: boolean
  aggregateRating: number | null
  reviewCount: number
  createdAt: string
  updatedAt: string
  // LLM config (AI agents)
  llmProvider: LlmProvider | null
  modelName: string | null
  systemPrompt: string | null
  temperature: number | null
  maxTokens: number | null
  maxIterations: number | null
  enabledTools: string[]
  activeVersionId?: string | null
  provider?: Pick<AgentProvider, "id" | "displayName">
  versions?: AgentVersion[]
  _count?: {
    projectAgents: number
    reviews: number
  }
}

export interface ProjectAgent {
  id: string
  projectId: string
  agentId: string
  role: ProjectRole
  customRole: string | null
  isCoordinator: boolean
  hiredAt: string
  hiredById: string
  revokedAt: string | null
  agent?: Pick<Agent, "id" | "name" | "type" | "pricingModel" | "aggregateRating"> & { provider?: Pick<AgentProvider, "id" | "displayName"> }
  agreement?: { id: string; acceptedAt: string } | null
}

export interface AgentReview {
  id: string
  agentId: string
  projectId: string
  reviewerId: string
  rating: number
  comment: string | null
  providerResponse: string | null
  createdAt: string
  reviewer?: Pick<User, "id" | "name" | "avatarUrl">
}

export interface Task {
  id: string
  projectId: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  assigneeId: string | null
  reporterId: string
  reporterType: string
  dueDate: string | null
  createdAt: string
  updatedAt: string
  assignee?: Pick<ProjectAgent, "id" | "role"> & { agent?: Pick<Agent, "id" | "name" | "type"> }
  activities?: Array<{ id: string; action: string; actorType: string; metadata?: unknown; createdAt: string }>
  blockedBy?: Array<{ blockingTaskId: string; blockingTask?: { id: string; title: string; status: TaskStatus } }>
  _count?: {
    comments: number
  }
}

export interface TaskComment {
  id: string
  taskId: string
  authorId: string
  authorType: "user" | "agent"
  content: string
  createdAt: string
}

export interface AgentRunStep {
  iteration: number
  timestamp: string
  llm_content: string | null
  tool_calls: Array<{
    name: string
    arguments: Record<string, unknown>
    result: string
  }>
  error?: string
  input_tokens?: number
  output_tokens?: number
  context_messages?: number
}

export interface AgentRunLog {
  id: string
  taskId: string
  agentId: string
  projectAgentId: string
  status: AgentRunStatus
  iterations: number
  totalInputTokens: number
  totalOutputTokens: number
  startedAt: string
  finishedAt: string | null
  log: AgentRunStep[]
}

export interface PlannerRunLog {
  id: string
  projectId: string
  status: "COMPLETED" | "FAILED"
  descriptionSnapshot: string | null
  planOutput: { roles: Array<{ name: string; description?: string }>; tasks: Array<{ title: string; role: string; priority?: string; description?: string }> } | null
  error: string | null
  totalInputTokens: number
  totalOutputTokens: number
  startedAt: string
  finishedAt: string | null
}

export interface BillingCycleSummary {
  periodStart: string
  periodEnd: string
  totalCents: number
  totalFormatted: string
  byProject: Array<{
    projectId: string
    projectName: string
    totalCents: number
    totalFormatted: string
    byAgent: Array<{
      agentId: string
      agentName: string
      totalCents: number
      totalFormatted: string
    }>
  }>
}

export interface ProviderEarnings {
  periodStart: string
  periodEnd: string
  totalCents: number
  totalFormatted: string
  byProject: Array<{
    projectId: string
    projectName: string
    totalCents: number
    totalFormatted: string
    byAgent: Array<{
      agentId: string
      agentName: string
      totalCents: number
      totalFormatted: string
    }>
  }>
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface Paginated<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}
