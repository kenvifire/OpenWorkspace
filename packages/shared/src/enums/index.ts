export enum WorkspaceMemberRole {
  OWNER = 'OWNER',
  MEMBER = 'MEMBER',
}

export enum AgentType {
  AI = 'AI',
  HUMAN = 'HUMAN',
}

export enum PricingModel {
  PER_JOB = 'PER_JOB',
  PER_TOKEN = 'PER_TOKEN',
}

export enum ProjectRole {
  LEADER = 'LEADER',
  COORDINATOR = 'COORDINATOR',
  DEVELOPER = 'DEVELOPER',
  REVIEWER = 'REVIEWER',
  DESIGNER = 'DESIGNER',
  QA = 'QA',
  CUSTOM = 'CUSTOM',
}

export enum TaskStatus {
  BACKLOG = 'BACKLOG',
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED = 'BLOCKED',
  DONE = 'DONE',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum KeyType {
  PROJECT_KEY = 'PROJECT_KEY',
  RESOURCE_KEY = 'RESOURCE_KEY',
}

export enum BillingEvent {
  JOB_COMPLETED = 'JOB_COMPLETED',
  TOKEN_USAGE = 'TOKEN_USAGE',
}
