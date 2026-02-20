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
  priority: number | null;
  tags: string | null;
  archivedAt: number | null;
  expiresAt: number | null;
  createdBy: string | null;
  createdAt: number;
  updatedAt: number;
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
