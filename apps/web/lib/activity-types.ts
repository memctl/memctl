export interface ActivityItem {
  id: string;
  action: string;
  toolName: string | null;
  memoryKey: string | null;
  details: string | null;
  sessionId: string | null;
  projectName: string;
  createdAt: string;
}

export interface AuditLogItem {
  id: string;
  action: string;
  actorName: string;
  targetUserName: string | null;
  details: string | null;
  createdAt: string;
}

export interface SessionItem {
  id: string;
  sessionId: string;
  branch: string | null;
  summary: string | null;
  keysRead: string | null;
  keysWritten: string | null;
  toolsUsed: string | null;
  startedAt: string;
  endedAt: string | null;
  projectName: string;
}

export interface ActivityFilters {
  action?: string;
  source?: "all" | "usage" | "dashboard";
  search?: string;
  from?: string; // ISO date
  to?: string; // ISO date
  type?: "all" | "activity" | "audit";
}

export interface ActivityFeedResponse {
  activities: ActivityItem[];
  auditLogs: AuditLogItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface SessionFeedResponse {
  sessions: SessionItem[];
  nextCursor: string | null;
  hasMore: boolean;
}
