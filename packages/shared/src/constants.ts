export const PLAN_IDS = [
  "free",
  "lite",
  "pro",
  "business",
  "scale",
  "enterprise",
] as const;

export type PlanId = (typeof PLAN_IDS)[number];

export const PLANS: Record<
  PlanId,
  {
    name: string;
    price: number;
    projectLimit: number;
    memberLimit: number;
    /** Soft limit per project — agents get a warning when approaching, not a hard block */
    memoryLimitPerProject: number;
    /** Hard org-wide ceiling (generous, acts as abuse prevention) */
    memoryLimitOrg: number;
    apiCallLimit: number;
    /** Per-minute API rate limit (sliding window) */
    apiRatePerMinute: number;
  }
> = {
  free: {
    name: "Free",
    price: 0,
    projectLimit: 3,
    memberLimit: 1,
    memoryLimitPerProject: 200,
    memoryLimitOrg: 500,
    apiCallLimit: Infinity,
    apiRatePerMinute: 60,
  },
  lite: {
    name: "Lite",
    price: 5,
    projectLimit: 10,
    memberLimit: 3,
    memoryLimitPerProject: 1_000,
    memoryLimitOrg: 10_000,
    apiCallLimit: Infinity,
    apiRatePerMinute: 300,
  },
  pro: {
    name: "Pro",
    price: 20,
    projectLimit: 25,
    memberLimit: 10,
    memoryLimitPerProject: 5_000,
    memoryLimitOrg: 100_000,
    apiCallLimit: Infinity,
    apiRatePerMinute: 1_000,
  },
  business: {
    name: "Business",
    price: 59,
    projectLimit: 100,
    memberLimit: 30,
    memoryLimitPerProject: 10_000,
    memoryLimitOrg: 500_000,
    apiCallLimit: Infinity,
    apiRatePerMinute: 3_000,
  },
  scale: {
    name: "Scale",
    price: 149,
    projectLimit: 500,
    memberLimit: 100,
    memoryLimitPerProject: 25_000,
    memoryLimitOrg: 2_000_000,
    apiCallLimit: Infinity,
    apiRatePerMinute: 10_000,
  },
  enterprise: {
    name: "Enterprise",
    price: -1,
    projectLimit: Infinity,
    memberLimit: Infinity,
    memoryLimitPerProject: Infinity,
    memoryLimitOrg: Infinity,
    apiCallLimit: Infinity,
    apiRatePerMinute: Infinity,
  },
};

export const ORG_STATUSES = ["active", "suspended", "banned"] as const;
export type OrgStatus = (typeof ORG_STATUSES)[number];

export const ORG_ROLES = ["owner", "admin", "member"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const ONBOARDING_HEARD_FROM = [
  "github",
  "twitter",
  "blog",
  "friend",
  "search",
  "other",
] as const;

export const ONBOARDING_ROLES = [
  "developer",
  "team_lead",
  "engineering_manager",
  "other",
] as const;

export const ONBOARDING_TEAM_SIZES = [
  "solo",
  "2-5",
  "6-20",
  "20+",
] as const;

export const ONBOARDING_USE_CASES = [
  "personal",
  "team",
  "enterprise",
  "open_source",
] as const;
