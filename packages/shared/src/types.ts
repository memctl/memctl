import type { PlanId, OrgRole } from "./constants";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  githubId: string | null;
  onboardingCompleted: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  planId: PlanId;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  projectLimit: number;
  memberLimit: number;
  companyName: string | null;
  taxId: string | null;
  billingAddress: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface OrganizationMember {
  id: string;
  orgId: string;
  userId: string;
  role: OrgRole;
  createdAt: number;
}

export interface Project {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Memory {
  id: string;
  projectId: string;
  key: string;
  content: string;
  metadata: string | null;
  scope: "project" | "shared";
  priority: number | null;
  tags: string | null;
  relatedKeys: string | null;
  pinnedAt: number | null;
  archivedAt: number | null;
  expiresAt: number | null;
  accessCount: number;
  lastAccessedAt: number | null;
  helpfulCount: number;
  unhelpfulCount: number;
  createdBy: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface MemorySnapshot {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  data: string;
  memoryCount: number;
  createdBy: string | null;
  createdAt: number;
}

export interface SessionLog {
  id: string;
  projectId: string;
  sessionId: string;
  branch: string | null;
  summary: string | null;
  keysRead: string | null;
  keysWritten: string | null;
  toolsUsed: string | null;
  startedAt: number;
  endedAt: number | null;
  createdBy: string | null;
}

export interface MemoryVersion {
  id: string;
  memoryId: string;
  version: number;
  content: string;
  metadata: string | null;
  changedBy: string | null;
  changeType: "created" | "updated" | "restored";
  createdAt: number;
}

export interface ActivityLog {
  id: string;
  projectId: string;
  sessionId: string | null;
  action: string;
  toolName: string | null;
  memoryKey: string | null;
  details: string | null;
  createdBy: string | null;
  createdAt: number;
}

export interface ContextType {
  id: string;
  orgId: string;
  slug: string;
  label: string;
  description: string;
  schema: string | null;
  icon: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface MemoryLock {
  id: string;
  projectId: string;
  memoryKey: string;
  lockedBy: string | null;
  expiresAt: number;
  createdAt: number;
}

export interface ProjectTemplate {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  data: string; // JSON array of memory entries
  isBuiltin: boolean;
  createdBy: string | null;
  createdAt: number;
}

export interface WebhookConfig {
  id: string;
  projectId: string;
  url: string;
  events: string | null;
  digestIntervalMinutes: number;
  lastSentAt: number | null;
  isActive: boolean;
  secret: string | null;
  createdAt: number;
}

export interface ApiToken {
  id: string;
  userId: string;
  orgId: string;
  name: string | null;
  tokenHash: string;
  lastUsedAt: number | null;
  expiresAt: number | null;
  createdAt: number;
  revokedAt: number | null;
}

export interface OnboardingResponse {
  id: string;
  userId: string;
  heardFrom: string | null;
  role: string | null;
  teamSize: string | null;
  useCase: string | null;
  createdAt: number;
}

export interface JwtPayload {
  userId: string;
  orgId: string;
  sessionId: string;
  jti: string;
  iat: number;
  exp: number;
}
