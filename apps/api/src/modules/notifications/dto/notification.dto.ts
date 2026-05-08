export interface NotificationData {
  taskTitle: string;
  projectName: string;
  workspaceSlug: string;
  actorName: string;
  taskId?: string;
  projectId?: string;
  oldStatus?: string;
  newStatus?: string;
  commentSnippet?: string;
}
