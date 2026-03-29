export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  leaderId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResourceKey {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  // value is never returned to the client — write-only
  createdAt: Date;
  createdById: string;
}
