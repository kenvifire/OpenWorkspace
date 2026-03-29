import axios from 'axios';
import { auth } from './firebase';
import type {
  Workspace,
  WorkspaceMember,
  WorkspaceProviderKey,
  Project,
  ProjectAgent,
  ResourceKey,
  Task,
  TaskComment,
  AgentRunLog,
  Agent,
  AgentProvider,
  AgentReview,
  BillingCycleSummary,
  ProviderEarnings,
  PlannerRunLog,
  Paginated,
} from '@openworkspace/api-types';
import type {
  CreateWorkspaceDto,
  InviteMemberDto,
  CreateProjectDto,
  UpdateProjectDto,
  HireAgentDto,
  AcceptAgreementDto,
  CreateTaskDto,
  UpdateTaskDto,
  CreateResourceKeyDto,
  UpsertProviderKeyDto,
  SetPlannerDto,
  AcceptPlanDto,
  RegisterProviderDto,
  CreateAgentDto,
  UpdateAgentDto,
  CreateReviewDto,
  MarketplaceSearchParams,
  CreateCheckoutDto,
} from '@openworkspace/api-types';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  withCredentials: true,
});

// Automatically attach a fresh Firebase JWT before every request.
api.interceptors.request.use(async (config) => {
  try {
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    console.error('[api] getIdToken failed:', e);
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject(err),
);

// ─── Workspaces ───────────────────────────────────────────────────────────────
export const workspacesApi = {
  list: (): Promise<Workspace[]> =>
    api.get('/api/workspaces').then((r) => r.data),
  get: (slug: string): Promise<Workspace & { members: WorkspaceMember[] }> =>
    api.get(`/api/workspaces/${slug}`).then((r) => r.data),
  create: (data: CreateWorkspaceDto): Promise<Workspace> =>
    api.post('/api/workspaces', data).then((r) => r.data),
  inviteMember: (id: string, data: InviteMemberDto): Promise<WorkspaceMember> =>
    api.post(`/api/workspaces/${id}/members`, data).then((r) => r.data),
  removeMember: (id: string, memberId: string): Promise<void> =>
    api.delete(`/api/workspaces/${id}/members/${memberId}`),
};

// ─── Projects ─────────────────────────────────────────────────────────────────
export const projectsApi = {
  list: (workspaceId: string): Promise<Project[]> =>
    api.get(`/api/workspaces/${workspaceId}/projects`).then((r) => r.data),
  get: (projectId: string): Promise<Project> =>
    api.get(`/api/workspaces/_/projects/${projectId}`).then((r) => r.data),
  create: (workspaceId: string, data: CreateProjectDto): Promise<Project> =>
    api.post(`/api/workspaces/${workspaceId}/projects`, data).then((r) => r.data),
  update: (projectId: string, data: UpdateProjectDto): Promise<Project> =>
    api.patch(`/api/workspaces/_/projects/${projectId}`, data).then((r) => r.data),
  listAgents: (projectId: string): Promise<ProjectAgent[]> =>
    api.get(`/api/workspaces/_/projects/${projectId}/agents`).then((r) => r.data),
  hireAgent: (projectId: string, data: HireAgentDto): Promise<{ projectAgent: ProjectAgent; rawKey: string }> =>
    api.post(`/api/workspaces/_/projects/${projectId}/agents`, data).then((r) => r.data),
  acceptAgreement: (projectId: string, projectAgentId: string, data: AcceptAgreementDto): Promise<void> =>
    api.post(`/api/workspaces/_/projects/${projectId}/agents/${projectAgentId}/accept-agreement`, data).then((r) => r.data),
  removeAgent: (projectId: string, projectAgentId: string): Promise<void> =>
    api.delete(`/api/workspaces/_/projects/${projectId}/agents/${projectAgentId}`),
};

// ─── Tasks ────────────────────────────────────────────────────────────────────
export const tasksApi = {
  list: (projectId: string): Promise<Task[]> =>
    api.get(`/api/projects/${projectId}/tasks`).then((r) => r.data),
  get: (projectId: string, taskId: string): Promise<Task & { comments: TaskComment[] }> =>
    api.get(`/api/projects/${projectId}/tasks/${taskId}`).then((r) => r.data),
  create: (projectId: string, data: CreateTaskDto): Promise<Task> =>
    api.post(`/api/projects/${projectId}/tasks`, data).then((r) => r.data),
  update: (projectId: string, taskId: string, data: UpdateTaskDto): Promise<Task> =>
    api.patch(`/api/projects/${projectId}/tasks/${taskId}`, data).then((r) => r.data),
  addComment: (projectId: string, taskId: string, content: string): Promise<TaskComment> =>
    api.post(`/api/projects/${projectId}/tasks/${taskId}/comments`, { content }).then((r) => r.data),
  delete: (projectId: string, taskId: string): Promise<void> =>
    api.delete(`/api/projects/${projectId}/tasks/${taskId}`).then((r) => r.data),
  listDeleted: (projectId: string): Promise<Array<{ id: string; title: string; description: string | null; status: string; priority: string; deletedAt: string }>> =>
    api.get(`/api/projects/${projectId}/tasks/deleted`).then((r) => r.data),
  restore: (projectId: string, taskId: string): Promise<void> =>
    api.post(`/api/projects/${projectId}/tasks/${taskId}/restore`).then((r) => r.data),
  permanentlyDelete: (projectId: string, taskId: string): Promise<void> =>
    api.delete(`/api/projects/${projectId}/tasks/${taskId}/permanent`).then((r) => r.data),
};

// ─── Marketplace ──────────────────────────────────────────────────────────────
export const marketplaceApi = {
  search: (params: MarketplaceSearchParams): Promise<Paginated<Agent>> =>
    api.get('/api/marketplace', { params }).then((r) => r.data),
  get: (agentId: string): Promise<Agent & { provider: AgentProvider }> =>
    api.get(`/api/marketplace/${agentId}`).then((r) => r.data),
  getTags: (): Promise<string[]> =>
    api.get('/api/marketplace/tags').then((r) => r.data),
  getReviews: (agentId: string, page = 1): Promise<Paginated<AgentReview>> =>
    api.get(`/api/agents/${agentId}/reviews`, { params: { page } }).then((r) => r.data),
  createReview: (agentId: string, projectId: string, data: CreateReviewDto): Promise<AgentReview> =>
    api.post(`/api/agents/${agentId}/reviews?projectId=${projectId}`, data).then((r) => r.data),
};

// ─── Keys ─────────────────────────────────────────────────────────────────────
export const keysApi = {
  list: (projectId: string): Promise<ResourceKey[]> =>
    api.get(`/api/projects/${projectId}/keys`).then((r) => r.data),
  create: (projectId: string, data: CreateResourceKeyDto): Promise<ResourceKey> =>
    api.post(`/api/projects/${projectId}/keys`, data).then((r) => r.data),
  delete: (projectId: string, keyId: string): Promise<void> =>
    api.delete(`/api/projects/${projectId}/keys/${keyId}`),
};

// ─── Billing ──────────────────────────────────────────────────────────────────
export const billingApi = {
  getCycleSummary: (workspaceId: string): Promise<BillingCycleSummary> =>
    api.get(`/api/workspaces/${workspaceId}/billing`).then((r) => r.data),
  createCheckout: (workspaceId: string, data: CreateCheckoutDto): Promise<{ url: string }> =>
    api.post(`/api/workspaces/${workspaceId}/billing/checkout`, data).then((r) => r.data),
  getProviderEarnings: (): Promise<ProviderEarnings> =>
    api.get('/api/providers/me/earnings').then((r) => r.data),
};

// ─── Workspace Provider Keys ──────────────────────────────────────────────────
export const workspaceKeysApi = {
  list: (workspaceId: string): Promise<WorkspaceProviderKey[]> =>
    api.get(`/api/workspaces/${workspaceId}/provider-keys`).then((r) => r.data),
  upsert: (workspaceId: string, data: UpsertProviderKeyDto): Promise<WorkspaceProviderKey> =>
    api.put(`/api/workspaces/${workspaceId}/provider-keys`, data).then((r) => r.data),
  delete: (workspaceId: string, provider: string): Promise<void> =>
    api.delete(`/api/workspaces/${workspaceId}/provider-keys/${provider}`),
};

// ─── Planner ──────────────────────────────────────────────────────────────────
export const plannerApi = {
  setPlanner: (projectId: string, data: SetPlannerDto): Promise<Project> =>
    api.post(`/api/projects/${projectId}/planner/set`, data).then((r) => r.data),
  unsetPlanner: (projectId: string): Promise<Project> =>
    api.delete(`/api/projects/${projectId}/planner/set`).then((r) => r.data),
  runPlanner: (projectId: string): Promise<AcceptPlanDto> =>
    api.post(`/api/projects/${projectId}/planner/run`).then((r) => r.data),
  acceptPlan: (projectId: string, data: AcceptPlanDto): Promise<Task[]> =>
    api.post(`/api/projects/${projectId}/planner/accept`, data).then((r) => r.data),
  getRuns: (projectId: string): Promise<PlannerRunLog[]> =>
    api.get(`/api/projects/${projectId}/planner/runs`).then((r) => r.data),
};

// ─── Agent Runs ───────────────────────────────────────────────────────────────
export const agentRunsApi = {
  list: (projectId: string, taskId: string): Promise<AgentRunLog[]> =>
    api.get(`/api/projects/${projectId}/tasks/${taskId}/runs`).then((r) => r.data),
  listByAgent: (projectId: string, projectAgentId: string): Promise<(AgentRunLog & { task: { id: string; title: string; status: string } })[]> =>
    api.get(`/api/projects/${projectId}/agents/${projectAgentId}/runs`).then((r) => r.data),
  trigger: (projectId: string, taskId: string): Promise<void> =>
    api.post(`/api/projects/${projectId}/tasks/${taskId}/runs`).then((r) => r.data),
  stop: (projectId: string, taskId: string): Promise<void> =>
    api.delete(`/api/projects/${projectId}/tasks/${taskId}/runs/active`),
};

// ─── Agents / Provider ────────────────────────────────────────────────────────
export const agentsApi = {
  getMyProvider: (): Promise<AgentProvider> =>
    api.get('/api/providers/me').then((r) => r.data),
  registerProvider: (data: RegisterProviderDto): Promise<AgentProvider> =>
    api.post('/api/providers', data).then((r) => r.data),
  acceptDpa: (dpaVersion: string): Promise<void> =>
    api.post('/api/providers/me/dpa', { dpaVersion }).then((r) => r.data),
  listMyAgents: (): Promise<Agent[]> =>
    api.get('/api/providers/me/agents').then((r) => r.data),
  createAgent: (data: CreateAgentDto): Promise<Agent> =>
    api.post('/api/providers/me/agents', data).then((r) => r.data),
  updateAgent: (agentId: string, data: UpdateAgentDto): Promise<Agent> =>
    api.patch(`/api/providers/me/agents/${agentId}`, data).then((r) => r.data),
  publishAgent: (agentId: string): Promise<Agent> =>
    api.post(`/api/providers/me/agents/${agentId}/publish`).then((r) => r.data),
  unpublishAgent: (agentId: string): Promise<Agent> =>
    api.post(`/api/providers/me/agents/${agentId}/unpublish`).then((r) => r.data),
};

// ─── Personal Agents ──────────────────────────────────────────────────────────
export type CreatePersonalAgentDto = {
  name: string;
  description?: string;
  llmProvider: string;
  modelName: string;
  systemPrompt?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  maxIterations?: number;
  enabledTools?: string[];
};

export type UpdatePersonalAgentDto = Partial<CreatePersonalAgentDto>;

export const myAgentsApi = {
  list: (): Promise<Agent[]> =>
    api.get('/api/my-agents').then((r) => r.data),
  create: (data: CreatePersonalAgentDto): Promise<Agent> =>
    api.post('/api/my-agents', data).then((r) => r.data),
  update: (agentId: string, data: UpdatePersonalAgentDto): Promise<Agent> =>
    api.patch(`/api/my-agents/${agentId}`, data).then((r) => r.data),
  delete: (agentId: string): Promise<void> =>
    api.delete(`/api/my-agents/${agentId}`),
  listSkills: (agentId: string): Promise<any[]> =>
    api.get(`/api/my-agents/${agentId}/skills`).then((r) => r.data),
  assignSkill: (agentId: string, skillId: string): Promise<void> =>
    api.post(`/api/my-agents/${agentId}/skills/${skillId}`).then((r) => r.data),
  removeSkill: (agentId: string, skillId: string): Promise<void> =>
    api.delete(`/api/my-agents/${agentId}/skills/${skillId}`),
  listMcps: (agentId: string): Promise<any[]> =>
    api.get(`/api/my-agents/${agentId}/mcps`).then((r) => r.data),
  assignMcp: (agentId: string, mcpId: string): Promise<void> =>
    api.post(`/api/my-agents/${agentId}/mcps/${mcpId}`).then((r) => r.data),
  removeMcp: (agentId: string, mcpId: string): Promise<void> =>
    api.delete(`/api/my-agents/${agentId}/mcps/${mcpId}`),
  publishVersion: (agentId: string, label?: string): Promise<Agent> =>
    api.post(`/api/my-agents/${agentId}/versions`, { label }).then((r) => r.data),
  deleteVersion: (agentId: string, versionId: string): Promise<Agent> =>
    api.delete(`/api/my-agents/${agentId}/versions/${versionId}`).then((r) => r.data),
  activateVersion: (agentId: string, versionId: string | null): Promise<Agent> =>
    api.patch(`/api/my-agents/${agentId}/versions/activate`, { versionId }).then((r) => r.data),
};

// ─── Skills ───────────────────────────────────────────────────────────────────
export type Skill = {
  id: string;
  userId: string;
  name: string;
  description: string;
  instructions: string;
  type: 'PROMPT' | 'WEBHOOK';
  webhookUrl?: string | null;
  webhookMethod?: string | null;
  webhookHeaders?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { agents: number };
};

export type CreateSkillDto = {
  name: string;
  description: string;
  instructions: string;
  type?: 'PROMPT' | 'WEBHOOK';
  webhookUrl?: string;
  webhookMethod?: string;
  webhookHeaders?: string;
};

export type UpdateSkillDto = Partial<CreateSkillDto>;

export const skillsApi = {
  list: (): Promise<Skill[]> =>
    api.get('/api/my-skills').then((r) => r.data),
  create: (data: CreateSkillDto): Promise<Skill> =>
    api.post('/api/my-skills', data).then((r) => r.data),
  update: (skillId: string, data: UpdateSkillDto): Promise<Skill> =>
    api.patch(`/api/my-skills/${skillId}`, data).then((r) => r.data),
  delete: (skillId: string): Promise<void> =>
    api.delete(`/api/my-skills/${skillId}`),
  // Project-agent level
  listForProjectAgent: (projectId: string, projectAgentId: string): Promise<{ skill: Skill }[]> =>
    api.get(`/api/projects/${projectId}/agents/${projectAgentId}/skills`).then((r) => r.data),
  assignToProjectAgent: (projectId: string, projectAgentId: string, skillId: string): Promise<void> =>
    api.post(`/api/projects/${projectId}/agents/${projectAgentId}/skills/${skillId}`).then((r) => r.data),
  removeFromProjectAgent: (projectId: string, projectAgentId: string, skillId: string): Promise<void> =>
    api.delete(`/api/projects/${projectId}/agents/${projectAgentId}/skills/${skillId}`),
};

// ─── Planning Agent ───────────────────────────────────────────────────────────
export type PlanningAgentVersion = {
  id: string;
  planningAgentId: string;
  versionNumber: number;
  label: string | null;
  customPrompt: string | null;
  publishedAt: string;
};

export type ProjectPlanningAgent = {
  id: string;
  projectId: string;
  customPrompt: string | null;
  activeVersionId: string | null;
  basePrompt: string;
  versions: PlanningAgentVersion[];
  createdAt: string;
  updatedAt: string;
};

export type PlanningAgentConfig = {
  basePrompt: string;
  userDefaultPrompt: string;
  provider: string | null;
  model: string | null;
  hasApiKey: boolean;
};

export const planningAgentApi = {
  getConfig: (): Promise<PlanningAgentConfig> =>
    api.get('/api/planning-agents/config').then((r) => r.data),
  updateConfig: (data: { userDefaultPrompt?: string; provider?: string | null; model?: string | null; apiKey?: string | null }): Promise<PlanningAgentConfig> =>
    api.patch('/api/planning-agents/config', data).then((r) => r.data),
  get: (projectId: string): Promise<ProjectPlanningAgent> =>
    api.get(`/api/projects/${projectId}/planning-agent`).then((r) => r.data),
  updatePrompt: (projectId: string, customPrompt: string): Promise<ProjectPlanningAgent> =>
    api.patch(`/api/projects/${projectId}/planning-agent/prompt`, { customPrompt }).then((r) => r.data),
  publishVersion: (projectId: string, label?: string): Promise<ProjectPlanningAgent> =>
    api.post(`/api/projects/${projectId}/planning-agent/versions`, { label }).then((r) => r.data),
  deleteVersion: (projectId: string, versionId: string): Promise<ProjectPlanningAgent> =>
    api.delete(`/api/projects/${projectId}/planning-agent/versions/${versionId}`).then((r) => r.data),
  activateVersion: (projectId: string, versionId: string | null): Promise<ProjectPlanningAgent> =>
    api.patch(`/api/projects/${projectId}/planning-agent/activate`, { versionId }).then((r) => r.data),
};

// ─── MCPs ─────────────────────────────────────────────────────────────────────
export type Mcp = {
  id: string;
  userId: string;
  name: string;
  description: string;
  transport: 'SSE' | 'HTTP' | 'STDIO';
  url?: string | null;
  command?: string | null;
  args: string[];
  headers?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { agents: number };
};

export type CreateMcpDto = {
  name: string;
  description: string;
  transport?: 'SSE' | 'HTTP' | 'STDIO';
  url?: string;
  command?: string;
  args?: string[];
  headers?: string;
};

export type UpdateMcpDto = Partial<CreateMcpDto>;

export const mcpsApi = {
  list: (): Promise<Mcp[]> =>
    api.get('/api/my-mcps').then((r) => r.data),
  create: (data: CreateMcpDto): Promise<Mcp> =>
    api.post('/api/my-mcps', data).then((r) => r.data),
  update: (mcpId: string, data: UpdateMcpDto): Promise<Mcp> =>
    api.patch(`/api/my-mcps/${mcpId}`, data).then((r) => r.data),
  delete: (mcpId: string): Promise<void> =>
    api.delete(`/api/my-mcps/${mcpId}`),
  // Project-agent level
  listForProjectAgent: (projectId: string, projectAgentId: string): Promise<{ mcp: Mcp }[]> =>
    api.get(`/api/projects/${projectId}/agents/${projectAgentId}/mcps`).then((r) => r.data),
  assignToProjectAgent: (projectId: string, projectAgentId: string, mcpId: string): Promise<void> =>
    api.post(`/api/projects/${projectId}/agents/${projectAgentId}/mcps/${mcpId}`).then((r) => r.data),
  removeFromProjectAgent: (projectId: string, projectAgentId: string, mcpId: string): Promise<void> =>
    api.delete(`/api/projects/${projectId}/agents/${projectAgentId}/mcps/${mcpId}`),
};
