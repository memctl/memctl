import { db } from "@/lib/db";
import { auditLogs } from "@memctl/db/schema";
import { generateId } from "@/lib/utils";

export type AuditAction =
  | "role_changed"
  | "member_removed"
  | "member_assigned"
  | "member_unassigned"
  | "project_created"
  | "project_updated"
  | "project_deleted";

export async function logAudit(params: {
  orgId: string;
  projectId?: string;
  actorId: string;
  action: AuditAction;
  targetUserId?: string;
  details?: Record<string, unknown>;
}) {
  await db.insert(auditLogs).values({
    id: generateId(),
    orgId: params.orgId,
    projectId: params.projectId ?? null,
    actorId: params.actorId,
    action: params.action,
    targetUserId: params.targetUserId ?? null,
    details: params.details ? JSON.stringify(params.details) : null,
  });
}
