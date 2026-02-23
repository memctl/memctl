import { PLAN_IDS, PLANS, type PlanId } from "@memctl/shared/constants";

/** Sentinel value for "unlimited" in SQLite integer columns (Infinity is not storable). */
const UNLIMITED_SENTINEL = 999999;

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
function clampLimit(value: number): number {
  return value === Infinity ? UNLIMITED_SENTINEL : value;
}

export function getOrgCreationLimits(planId?: PlanId): {
  planId: PlanId;
  projectLimit: number;
  memberLimit: number;
} {
  const resolvedPlan = planId ?? getDefaultPlanId();
  const plan = PLANS[resolvedPlan] ?? PLANS.free;
  return {
    planId: resolvedPlan,
    projectLimit: clampLimit(plan.projectLimit),
    memberLimit: clampLimit(plan.memberLimit),
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
}): PlanId {
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
