import { PLAN_IDS, PLANS, type PlanId } from "@memctl/shared/constants";

/** Sentinel value for "unlimited" in SQLite integer columns (Infinity is not storable). */
export const UNLIMITED_SENTINEL = 999999;

export function isSelfHosted(): boolean {
  return process.env.SELF_HOSTED === "true";
}

export function isBillingEnabled(): boolean {
  if (isSelfHosted()) return false;
  return !!process.env.STRIPE_SECRET_KEY;
}

export function getDefaultPlanId(): PlanId {
  if (isSelfHosted()) return "enterprise";

  if (process.env.NODE_ENV === "development" && process.env.DEV_PLAN) {
    const devPlan = process.env.DEV_PLAN as PlanId;
    if (devPlan in PLANS) return devPlan;
  }

  return "free";
}

/** Clamp Infinity → UNLIMITED_SENTINEL for SQLite storage. */
export function clampLimit(value: number): number {
  return value === Infinity ? UNLIMITED_SENTINEL : value;
}

export function getOrgCreationLimits(planId?: PlanId): {
  planId: PlanId;
  projectLimit: number;
  memberLimit: number;
  memoryLimitPerProject: null;
  memoryLimitOrg: null;
  apiRatePerMinute: null;
  customLimits: false;
} {
  const resolvedPlan = planId ?? getDefaultPlanId();
  const plan = PLANS[resolvedPlan] ?? PLANS.free;
  return {
    planId: resolvedPlan,
    projectLimit: clampLimit(plan.projectLimit),
    memberLimit: clampLimit(plan.memberLimit),
    memoryLimitPerProject: null,
    memoryLimitOrg: null,
    apiRatePerMinute: null,
    customLimits: false,
  };
}

export interface OrgLimits {
  projectLimit: number;
  memberLimit: number;
  memoryLimitPerProject: number;
  memoryLimitOrg: number;
  apiRatePerMinute: number;
}

export function getOrgLimits(org: {
  planId: string;
  planOverride: string | null;
  projectLimit: number;
  memberLimit: number;
  memoryLimitPerProject: number | null;
  memoryLimitOrg: number | null;
  apiRatePerMinute: number | null;
}): OrgLimits {
  const planId = getEffectivePlanId(org);
  const plan = PLANS[planId] ?? PLANS.free;
  return {
    projectLimit: org.projectLimit,
    memberLimit: org.memberLimit,
    memoryLimitPerProject:
      org.memoryLimitPerProject ?? clampLimit(plan.memoryLimitPerProject),
    memoryLimitOrg: org.memoryLimitOrg ?? clampLimit(plan.memoryLimitOrg),
    apiRatePerMinute: org.apiRatePerMinute ?? clampLimit(plan.apiRatePerMinute),
  };
}

/** Format a DB limit value for display — shows "∞" for unlimited sentinel. */
export function formatLimitValue(value: number): string {
  return value >= UNLIMITED_SENTINEL ? "∞" : value.toLocaleString();
}

/** Check whether a DB limit value represents "unlimited". */
export function isUnlimited(value: number): boolean {
  return value >= UNLIMITED_SENTINEL;
}

/** Max free-plan orgs a user can own (paid orgs don't count). */
export const FREE_ORG_LIMIT_PER_USER = 3;

/** Max invitations an org can send per day (all invitations count, including revoked). */
export const INVITATIONS_PER_DAY = 20;

/** Max pending (non-accepted) invitations per org at any time. */
export const MAX_PENDING_INVITATIONS = 50;

export function getEffectivePlanId(org: {
  planId: string;
  planOverride: string | null;
  trialEndsAt?: Date | null;
  planExpiresAt?: Date | null;
}): PlanId {
  const now = new Date();

  // Expired trial falls back to free (unless Stripe subscription is active via planId)
  if (org.trialEndsAt && org.trialEndsAt <= now) {
    // Trial expired, check if there's still a valid Stripe plan
    if (
      (PLAN_IDS as readonly string[]).includes(org.planId) &&
      org.planId !== "free"
    ) {
      return org.planId as PlanId;
    }
    return "free";
  }

  // Plan expiry check (lazy evaluation)
  if (org.planExpiresAt && org.planExpiresAt <= now) {
    return "free";
  }

  if (
    org.planOverride &&
    (PLAN_IDS as readonly string[]).includes(org.planOverride)
  ) {
    return org.planOverride as PlanId;
  }
  if ((PLAN_IDS as readonly string[]).includes(org.planId)) {
    return org.planId as PlanId;
  }
  return "free";
}

export function isActiveTrial(org: { trialEndsAt: Date | null }): boolean {
  if (!org.trialEndsAt) return false;
  return org.trialEndsAt > new Date();
}

export function daysUntilExpiry(org: {
  planExpiresAt: Date | null;
  trialEndsAt: Date | null;
}): number | null {
  const target = org.trialEndsAt ?? org.planExpiresAt;
  if (!target) return null;
  const diffMs = target.getTime() - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function planExpiresWithinDays(
  org: { planExpiresAt: Date | null; trialEndsAt: Date | null },
  days: number,
): boolean {
  const remaining = daysUntilExpiry(org);
  if (remaining === null) return false;
  return remaining <= days && remaining > 0;
}
