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
    memoryLimit: number;
    apiCallLimit: number;
  }
> = {
  free: {
    name: "Free",
    price: 0,
    projectLimit: 2,
    memberLimit: 2,
    memoryLimit: 1_000,
    apiCallLimit: 10_000,
  },
  lite: {
    name: "Lite",
    price: 5,
    projectLimit: 5,
    memberLimit: 5,
    memoryLimit: 5_000,
    apiCallLimit: 50_000,
  },
  pro: {
    name: "Pro",
    price: 20,
    projectLimit: 20,
    memberLimit: 15,
    memoryLimit: 25_000,
    apiCallLimit: 250_000,
  },
  business: {
    name: "Business",
    price: 40,
    projectLimit: 50,
    memberLimit: 50,
    memoryLimit: 100_000,
    apiCallLimit: 1_000_000,
  },
  scale: {
    name: "Scale",
    price: 80,
    projectLimit: 200,
    memberLimit: 200,
    memoryLimit: 500_000,
    apiCallLimit: 5_000_000,
  },
  enterprise: {
    name: "Enterprise",
    price: -1,
    projectLimit: Infinity,
    memberLimit: Infinity,
    memoryLimit: Infinity,
    apiCallLimit: Infinity,
  },
};

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
