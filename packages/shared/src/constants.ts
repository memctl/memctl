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
    /** Hard per-project limit — blocks writes when reached */
    memoryLimitPerProject: number;
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
    memoryLimitPerProject: 400,
    apiCallLimit: Infinity,
    apiRatePerMinute: 60,
  },
  lite: {
    name: "Lite",
    price: 5,
    projectLimit: 10,
    memberLimit: 3,
    memoryLimitPerProject: 1_200,
    apiCallLimit: Infinity,
    apiRatePerMinute: 100,
  },
  pro: {
    name: "Pro",
    price: 18,
    projectLimit: 25,
    memberLimit: 10,
    memoryLimitPerProject: 5_000,
    apiCallLimit: Infinity,
    apiRatePerMinute: 150,
  },
  business: {
    name: "Business",
    price: 59,
    projectLimit: 100,
    memberLimit: 30,
    memoryLimitPerProject: 10_000,
    apiCallLimit: Infinity,
    apiRatePerMinute: 150,
  },
  scale: {
    name: "Scale",
    price: 149,
    projectLimit: 150,
    memberLimit: 100,
    memoryLimitPerProject: 25_000,
    apiCallLimit: Infinity,
    apiRatePerMinute: 150,
  },
  enterprise: {
    name: "Enterprise",
    price: -1,
    projectLimit: Infinity,
    memberLimit: Infinity,
    memoryLimitPerProject: Infinity,
    apiCallLimit: Infinity,
    apiRatePerMinute: 150,
  },
};

/** Per-seat monthly price in dollars for extra members beyond plan-included seats. */
export const EXTRA_SEAT_PRICE = 8;

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

export const ONBOARDING_TEAM_SIZES = ["solo", "2-5", "6-20", "20+"] as const;

export const ONBOARDING_USE_CASES = [
  "personal",
  "team",
  "enterprise",
  "open_source",
] as const;
