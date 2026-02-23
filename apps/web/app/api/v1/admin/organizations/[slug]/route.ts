import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import {
  organizations,
  organizationMembers,
  projects,
  users,
  adminActions,
} from "@memctl/db/schema";
import { eq, and, count } from "drizzle-orm";
import { adminOrgActionSchema } from "@memctl/shared/validators";
import { nanoid } from "nanoid";
import { PLANS } from "@memctl/shared/constants";
import { getEffectivePlanId } from "@/lib/plans";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (!org) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [owner] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, org.ownerId))
    .limit(1);

  const [memberCount] = await db
    .select({ value: count() })
    .from(organizationMembers)
    .where(eq(organizationMembers.orgId, org.id));

  const [projectCount] = await db
    .select({ value: count() })
    .from(projects)
    .where(eq(projects.orgId, org.id));

  return NextResponse.json({
    result: {
      ...org,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
      statusChangedAt: org.statusChangedAt?.toISOString() ?? null,
      ownerName: owner?.name ?? "Unknown",
      ownerEmail: owner?.email ?? null,
      memberCount: memberCount?.value ?? 0,
      projectCount: projectCount?.value ?? 0,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;

  const body = await req.json();
  const parsed = adminOrgActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (!org) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const action = parsed.data;
  const adminId = session.user.id;
  const now = new Date();
  let details: Record<string, unknown> = {};

  switch (action.action) {
    case "suspend": {
      details = { previousStatus: org.status, reason: action.reason };
      await db
        .update(organizations)
        .set({
          status: "suspended",
          statusReason: action.reason,
          statusChangedAt: now,
          statusChangedBy: adminId,
          updatedAt: now,
        })
        .where(eq(organizations.id, org.id));
      break;
    }

    case "ban": {
      details = { previousStatus: org.status, reason: action.reason };
      await db
        .update(organizations)
        .set({
          status: "banned",
          statusReason: action.reason,
          statusChangedAt: now,
          statusChangedBy: adminId,
          updatedAt: now,
        })
        .where(eq(organizations.id, org.id));
      break;
    }

    case "reactivate": {
      details = { previousStatus: org.status, reason: action.reason };
      await db
        .update(organizations)
        .set({
          status: "active",
          statusReason: null,
          statusChangedAt: now,
          statusChangedBy: adminId,
          updatedAt: now,
        })
        .where(eq(organizations.id, org.id));
      break;
    }

    case "override_plan": {
      details = {
        previousPlanOverride: org.planOverride,
        newPlanOverride: action.planId,
      };
      await db
        .update(organizations)
        .set({
          planOverride: action.planId,
          updatedAt: now,
        })
        .where(eq(organizations.id, org.id));
      break;
    }

    case "override_limits": {
      details = {
        previousProjectLimit: org.projectLimit,
        previousMemberLimit: org.memberLimit,
        previousMemoryLimitPerProject: org.memoryLimitPerProject,
        previousMemoryLimitOrg: org.memoryLimitOrg,
        previousApiRatePerMinute: org.apiRatePerMinute,
        newProjectLimit: action.projectLimit ?? org.projectLimit,
        newMemberLimit: action.memberLimit ?? org.memberLimit,
        newMemoryLimitPerProject: action.memoryLimitPerProject ?? org.memoryLimitPerProject,
        newMemoryLimitOrg: action.memoryLimitOrg ?? org.memoryLimitOrg,
        newApiRatePerMinute: action.apiRatePerMinute ?? org.apiRatePerMinute,
      };
      const updates: Record<string, unknown> = { updatedAt: now, customLimits: true };
      if (action.projectLimit !== undefined)
        updates.projectLimit = action.projectLimit;
      if (action.memberLimit !== undefined)
        updates.memberLimit = action.memberLimit;
      if (action.memoryLimitPerProject !== undefined)
        updates.memoryLimitPerProject = action.memoryLimitPerProject;
      if (action.memoryLimitOrg !== undefined)
        updates.memoryLimitOrg = action.memoryLimitOrg;
      if (action.apiRatePerMinute !== undefined)
        updates.apiRatePerMinute = action.apiRatePerMinute;
      await db
        .update(organizations)
        .set(updates)
        .where(eq(organizations.id, org.id));
      break;
    }

    case "reset_limits": {
      const effectivePlanId = getEffectivePlanId(org);
      const plan = PLANS[effectivePlanId] ?? PLANS.free;
      details = {
        previousCustomLimits: org.customLimits,
        previousMemoryLimitPerProject: org.memoryLimitPerProject,
        previousMemoryLimitOrg: org.memoryLimitOrg,
        previousApiRatePerMinute: org.apiRatePerMinute,
        resetToPlan: effectivePlanId,
      };
      await db
        .update(organizations)
        .set({
          projectLimit: plan.projectLimit === Infinity ? 999999 : plan.projectLimit,
          memberLimit: plan.memberLimit === Infinity ? 999999 : plan.memberLimit,
          memoryLimitPerProject: null,
          memoryLimitOrg: null,
          apiRatePerMinute: null,
          customLimits: false,
          updatedAt: now,
        })
        .where(eq(organizations.id, org.id));
      break;
    }

    case "transfer_ownership": {
      const [newOwnerMember] = await db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.orgId, org.id),
            eq(organizationMembers.userId, action.newOwnerId),
          ),
        )
        .limit(1);

      if (!newOwnerMember) {
        return NextResponse.json(
          { error: "New owner must be an existing member of the organization" },
          { status: 400 },
        );
      }

      details = {
        previousOwnerId: org.ownerId,
        newOwnerId: action.newOwnerId,
      };

      // Update org owner
      await db
        .update(organizations)
        .set({ ownerId: action.newOwnerId, updatedAt: now })
        .where(eq(organizations.id, org.id));

      // Demote old owner to admin
      await db
        .update(organizationMembers)
        .set({ role: "admin" })
        .where(
          and(
            eq(organizationMembers.orgId, org.id),
            eq(organizationMembers.userId, org.ownerId),
          ),
        );

      // Promote new owner
      await db
        .update(organizationMembers)
        .set({ role: "owner" })
        .where(
          and(
            eq(organizationMembers.orgId, org.id),
            eq(organizationMembers.userId, action.newOwnerId),
          ),
        );
      break;
    }

    case "update_notes": {
      details = {
        previousNotes: org.adminNotes,
        newNotes: action.notes,
      };
      await db
        .update(organizations)
        .set({ adminNotes: action.notes, updatedAt: now })
        .where(eq(organizations.id, org.id));
      break;
    }
  }

  const actionNameMap: Record<string, string> = {
    suspend: "org_suspended",
    ban: "org_banned",
    reactivate: "org_reactivated",
    override_plan: "plan_overridden",
    override_limits: "limits_overridden",
    reset_limits: "limits_reset",
    transfer_ownership: "ownership_transferred",
    update_notes: "notes_updated",
  };
  const actionName = actionNameMap[action.action] ?? action.action;

  await db.insert(adminActions).values({
    id: nanoid(),
    orgId: org.id,
    adminId,
    action: actionName,
    details: JSON.stringify(details),
    createdAt: now,
  });

  return NextResponse.json({ success: true });
}
