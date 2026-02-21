import { PLANS, type PlanId } from "@memctl/shared/constants";

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
