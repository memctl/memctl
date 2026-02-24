import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import {
  organizations,
  organizationMembers,
  projects,
  users,
  adminActions,
  planTemplates,
} from "@memctl/db/schema";
import { eq, and, count } from "drizzle-orm";
import { adminOrgActionSchema } from "@memctl/shared/validators";
import { generateId } from "@/lib/utils";
import { PLANS, type PlanId } from "@memctl/shared/constants";
import { getEffectivePlanId, clampLimit, isBillingEnabled } from "@/lib/plans";
import {
  createCustomPrice,
  createAdminSubscription,
  cancelAdminSubscription,
  getStripe,
} from "@/lib/stripe";

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
      planExpiresAt: org.planExpiresAt?.toISOString() ?? null,
      trialEndsAt: org.trialEndsAt?.toISOString() ?? null,
      contractStartDate: org.contractStartDate?.toISOString() ?? null,
      contractEndDate: org.contractEndDate?.toISOString() ?? null,
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
        previousApiRatePerMinute: org.apiRatePerMinute,
        newProjectLimit: action.projectLimit ?? org.projectLimit,
        newMemberLimit: action.memberLimit ?? org.memberLimit,
        newMemoryLimitPerProject:
          action.memoryLimitPerProject ?? org.memoryLimitPerProject,
        newApiRatePerMinute: action.apiRatePerMinute ?? org.apiRatePerMinute,
      };
      const updates: Record<string, unknown> = {
        updatedAt: now,
        customLimits: true,
      };
      if (action.projectLimit !== undefined)
        updates.projectLimit = action.projectLimit;
      if (action.memberLimit !== undefined)
        updates.memberLimit = action.memberLimit;
      if (action.memoryLimitPerProject !== undefined)
        updates.memoryLimitPerProject = action.memoryLimitPerProject;
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
        previousApiRatePerMinute: org.apiRatePerMinute,
        resetToPlan: effectivePlanId,
      };
      await db
        .update(organizations)
        .set({
          projectLimit:
            plan.projectLimit === Infinity ? 999999 : plan.projectLimit,
          memberLimit:
            plan.memberLimit === Infinity ? 999999 : plan.memberLimit,
          memoryLimitPerProject: null,
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

    case "start_trial": {
      const trialEnd = new Date(
        now.getTime() + action.durationDays * 24 * 60 * 60 * 1000,
      );
      details = {
        durationDays: action.durationDays,
        trialEndsAt: trialEnd.toISOString(),
      };
      const enterprisePlan = PLANS.enterprise;
      const updates: Record<string, unknown> = {
        planOverride: "enterprise",
        trialEndsAt: trialEnd,
        customLimits: true,
        updatedAt: now,
      };
      if (!org.memoryLimitPerProject && !org.apiRatePerMinute) {
        updates.projectLimit = clampLimit(enterprisePlan.projectLimit);
        updates.memberLimit = clampLimit(enterprisePlan.memberLimit);
        updates.memoryLimitPerProject = clampLimit(
          enterprisePlan.memoryLimitPerProject,
        );
        updates.apiRatePerMinute = clampLimit(enterprisePlan.apiRatePerMinute);
      }
      await db
        .update(organizations)
        .set(updates)
        .where(eq(organizations.id, org.id));
      break;
    }

    case "end_trial": {
      details = { previousTrialEndsAt: org.trialEndsAt?.toISOString() ?? null };
      const freePlan = PLANS.free;
      await db
        .update(organizations)
        .set({
          trialEndsAt: null,
          planOverride: null,
          customLimits: false,
          projectLimit: freePlan.projectLimit,
          memberLimit: freePlan.memberLimit,
          memoryLimitPerProject: null,
          apiRatePerMinute: null,
          updatedAt: now,
        })
        .where(eq(organizations.id, org.id));
      break;
    }

    case "set_expiry": {
      const expiresAt = new Date(action.expiresAt);
      details = { expiresAt: expiresAt.toISOString() };
      await db
        .update(organizations)
        .set({ planExpiresAt: expiresAt, updatedAt: now })
        .where(eq(organizations.id, org.id));
      break;
    }

    case "clear_expiry": {
      details = { previousExpiresAt: org.planExpiresAt?.toISOString() ?? null };
      await db
        .update(organizations)
        .set({ planExpiresAt: null, updatedAt: now })
        .where(eq(organizations.id, org.id));
      break;
    }

    case "create_subscription": {
      if (!isBillingEnabled()) {
        return NextResponse.json(
          { error: "Billing is not enabled" },
          { status: 400 },
        );
      }
      if (org.stripeSubscriptionId) {
        return NextResponse.json(
          { error: "Organization already has an active subscription" },
          { status: 400 },
        );
      }

      let customerId = org.stripeCustomerId;
      if (!customerId) {
        const customer = await getStripe().customers.create({
          name: org.name,
          metadata: { orgSlug: org.slug, orgId: org.id },
        });
        customerId = customer.id;
        await db
          .update(organizations)
          .set({ stripeCustomerId: customerId })
          .where(eq(organizations.id, org.id));
      }

      const { productId, priceId } = await createCustomPrice({
        unitAmountCents: action.priceInCents,
        productName: `Enterprise plan for ${org.name}`,
        interval: action.interval,
      });

      const { subscriptionId } = await createAdminSubscription({
        customerId,
        priceId,
        orgSlug: org.slug,
        entitlementPlanId: "enterprise",
      });

      details = {
        productId,
        priceId,
        subscriptionId,
        priceInCents: action.priceInCents,
        interval: action.interval,
      };

      const subUpdates: Record<string, unknown> = {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        planId: "enterprise",
        planOverride: "enterprise",
        planTemplateId: null,
        trialEndsAt: null,
        planExpiresAt: null,
        updatedAt: now,
      };
      if (!org.customLimits) {
        Object.assign(subUpdates, getPlanBaseLimitUpdates("enterprise"));
      }
      await db
        .update(organizations)
        .set(subUpdates)
        .where(eq(organizations.id, org.id));
      break;
    }

    case "cancel_subscription": {
      if (!org.stripeSubscriptionId) {
        return NextResponse.json(
          { error: "No active subscription" },
          { status: 400 },
        );
      }

      details = { subscriptionId: org.stripeSubscriptionId };

      try {
        await cancelAdminSubscription(org.stripeSubscriptionId);
      } catch (err) {
        console.error("Failed to cancel subscription in Stripe:", err);
      }

      const freePlan = PLANS.free;
      await db
        .update(organizations)
        .set({
          planId: "free",
          planOverride: null,
          customLimits: false,
          projectLimit: freePlan.projectLimit,
          memberLimit: freePlan.memberLimit,
          memoryLimitPerProject: null,
          apiRatePerMinute: null,
          planTemplateId: null,
          trialEndsAt: null,
          planExpiresAt: null,
          stripeSubscriptionId: null,
          updatedAt: now,
        })
        .where(eq(organizations.id, org.id));
      break;
    }

    case "update_contract": {
      details = {
        previousContractValue: org.contractValue,
        previousContractNotes: org.contractNotes,
      };
      const contractUpdates: Record<string, unknown> = { updatedAt: now };
      if (action.contractValue !== undefined)
        contractUpdates.contractValue = action.contractValue;
      if (action.contractNotes !== undefined)
        contractUpdates.contractNotes = action.contractNotes;
      if (action.contractStartDate !== undefined)
        contractUpdates.contractStartDate = action.contractStartDate
          ? new Date(action.contractStartDate)
          : null;
      if (action.contractEndDate !== undefined)
        contractUpdates.contractEndDate = action.contractEndDate
          ? new Date(action.contractEndDate)
          : null;
      await db
        .update(organizations)
        .set(contractUpdates)
        .where(eq(organizations.id, org.id));
      break;
    }

    case "apply_template": {
      const [template] = await db
        .select()
        .from(planTemplates)
        .where(eq(planTemplates.id, action.templateId))
        .limit(1);

      if (!template) {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 },
        );
      }

      details = {
        templateId: template.id,
        templateName: template.name,
        basePlanId: template.basePlanId,
        createSubscription: action.createSubscription ?? false,
      };

      const templateUpdates: Record<string, unknown> = {
        planId: template.basePlanId,
        planOverride: template.basePlanId,
        customLimits: true,
        projectLimit: template.projectLimit,
        memberLimit: template.memberLimit,
        memoryLimitPerProject: template.memoryLimitPerProject,
        apiRatePerMinute: template.apiRatePerMinute,
        planTemplateId: template.id,
        trialEndsAt: null,
        planExpiresAt: null,
        updatedAt: now,
      };

      if (action.createSubscription) {
        if (!isBillingEnabled()) {
          return NextResponse.json(
            { error: "Billing is not enabled" },
            { status: 400 },
          );
        }
        if (!template.stripePriceInCents) {
          return NextResponse.json(
            { error: "Template does not have a Stripe price configured" },
            { status: 400 },
          );
        }
        if (org.stripeSubscriptionId) {
          return NextResponse.json(
            { error: "Organization already has an active subscription" },
            { status: 400 },
          );
        }

        let customerId = org.stripeCustomerId;
        if (!customerId) {
          const customer = await getStripe().customers.create({
            name: org.name,
            metadata: { orgSlug: org.slug, orgId: org.id },
          });
          customerId = customer.id;
        }

        const interval = action.subscriptionInterval ?? "month";
        const { productId, priceId } = await createCustomPrice({
          unitAmountCents: template.stripePriceInCents,
          productName: `${template.name} plan for ${org.name}`,
          interval,
        });
        const { subscriptionId } = await createAdminSubscription({
          customerId,
          priceId,
          orgSlug: org.slug,
          entitlementPlanId: template.basePlanId as PlanId,
        });

        templateUpdates.stripeCustomerId = customerId;
        templateUpdates.stripeSubscriptionId = subscriptionId;
        details = {
          ...details,
          productId,
          priceId,
          subscriptionId,
          priceInCents: template.stripePriceInCents,
          interval,
        };
      }

      await db
        .update(organizations)
        .set(templateUpdates)
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
    start_trial: "trial_started",
    end_trial: "trial_ended",
    set_expiry: "expiry_set",
    clear_expiry: "expiry_cleared",
    create_subscription: "subscription_created",
    cancel_subscription: "subscription_cancelled",
    update_contract: "contract_updated",
    apply_template: "template_applied",
  };
  const actionName = actionNameMap[action.action] ?? action.action;

  await db.insert(adminActions).values({
    id: generateId(),
    orgId: org.id,
    adminId,
    action: actionName,
    details: JSON.stringify(details),
    createdAt: now,
  });

  return NextResponse.json({ success: true });
}

function getPlanBaseLimitUpdates(planId: PlanId) {
  const plan = PLANS[planId] ?? PLANS.free;
  return {
    projectLimit: clampLimit(plan.projectLimit),
    memberLimit: clampLimit(plan.memberLimit),
    memoryLimitPerProject: null,
    apiRatePerMinute: null,
    customLimits: false,
  };
}
