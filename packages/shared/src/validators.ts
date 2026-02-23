import { z } from "zod";
import { PLAN_IDS, ORG_ROLES } from "./constants";

export const slugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    "Slug must be lowercase alphanumeric with hyphens, cannot start or end with hyphen",
  );

export const orgCreateSchema = z.object({
  name: z.string().min(1).max(128),
  slug: slugSchema,
});

export const projectCreateSchema = z.object({
  name: z.string().min(1).max(128),
  slug: slugSchema,
  description: z.string().max(512).optional(),
});

export const projectUpdateSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(512).optional(),
});

export const memoryStoreSchema = z.object({
  key: z.string().min(1).max(256),
  content: z.string().min(1).max(65536),
  metadata: z.record(z.unknown()).optional(),
  scope: z.enum(["project", "shared"]).default("project"),
  priority: z.number().int().min(0).max(100).optional(),
  tags: z.array(z.string().min(1).max(64)).max(20).optional(),
  expiresAt: z.number().int().optional(),
});

export const memoryUpdateSchema = z.object({
  content: z.string().min(1).max(65536).optional(),
  metadata: z.record(z.unknown()).optional(),
  priority: z.number().int().min(0).max(100).optional(),
  tags: z.array(z.string().min(1).max(64)).max(20).optional(),
  expiresAt: z.number().int().nullable().optional(),
});

export const memorySearchSchema = z.object({
  query: z.string().min(1).max(256),
  limit: z.number().int().min(1).max(100).default(20),
});

export const memoryBulkGetSchema = z.object({
  keys: z.array(z.string().min(1).max(256)).min(1).max(50),
});

export const contextTypeCreateSchema = z.object({
  slug: slugSchema,
  label: z.string().min(1).max(128),
  description: z.string().min(1).max(512),
  schema: z.string().max(65536).optional(),
  icon: z.string().max(64).optional(),
});

export const contextTypeUpdateSchema = z.object({
  label: z.string().min(1).max(128).optional(),
  description: z.string().min(1).max(512).optional(),
  schema: z.string().max(65536).optional(),
  icon: z.string().max(64).optional(),
});

export const apiTokenCreateSchema = z.object({
  name: z.string().min(1).max(128),
  expiresAt: z.number().int().optional(),
});

export const onboardingSchema = z.object({
  heardFrom: z.string().optional(),
  role: z.string().optional(),
  teamSize: z.string().optional(),
  useCase: z.string().optional(),
  orgName: z.string().min(1).max(128),
  orgSlug: slugSchema,
});

export const memberInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(ORG_ROLES).default("member"),
});

export const memberRoleUpdateSchema = z.object({
  role: z.enum(["admin", "member"]),
});

export const projectAssignmentSchema = z.object({
  projectIds: z.array(z.string().min(1)).default([]),
});

export const planIdSchema = z.enum(PLAN_IDS);

export const adminOrgActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("suspend"), reason: z.string().min(1).max(1024) }),
  z.object({ action: z.literal("ban"), reason: z.string().min(1).max(1024) }),
  z.object({ action: z.literal("reactivate"), reason: z.string().max(1024).optional() }),
  z.object({ action: z.literal("override_plan"), planId: planIdSchema.nullable() }),
  z.object({
    action: z.literal("override_limits"),
    projectLimit: z.number().int().min(1).optional(),
    memberLimit: z.number().int().min(1).optional(),
    memoryLimitPerProject: z.number().int().min(1).optional(),
    memoryLimitOrg: z.number().int().min(1).optional(),
    apiRatePerMinute: z.number().int().min(1).optional(),
  }),
  z.object({ action: z.literal("reset_limits") }),
  z.object({ action: z.literal("transfer_ownership"), newOwnerId: z.string().min(1) }),
  z.object({ action: z.literal("update_notes"), notes: z.string().max(4096) }),
  z.object({
    action: z.literal("start_trial"),
    durationDays: z.number().int().min(1).max(365),
  }),
  z.object({ action: z.literal("end_trial") }),
  z.object({
    action: z.literal("set_expiry"),
    expiresAt: z.number().int(),
  }),
  z.object({ action: z.literal("clear_expiry") }),
  z.object({
    action: z.literal("create_subscription"),
    priceInCents: z.number().int().min(100),
    interval: z.enum(["month", "year"]).default("month"),
  }),
  z.object({ action: z.literal("cancel_subscription") }),
  z.object({
    action: z.literal("update_contract"),
    contractValue: z.number().int().min(0).nullable().optional(),
    contractNotes: z.string().max(4096).nullable().optional(),
    contractStartDate: z.number().int().nullable().optional(),
    contractEndDate: z.number().int().nullable().optional(),
  }),
  z.object({
    action: z.literal("apply_template"),
    templateId: z.string().min(1),
  }),
]);

export const planTemplateCreateSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(512).optional(),
  basePlanId: planIdSchema.default("enterprise"),
  projectLimit: z.number().int().min(1),
  memberLimit: z.number().int().min(1),
  memoryLimitPerProject: z.number().int().min(1),
  memoryLimitOrg: z.number().int().min(1),
  apiRatePerMinute: z.number().int().min(1),
  stripePriceInCents: z.number().int().min(100).nullable().optional(),
});

export const planTemplateUpdateSchema = planTemplateCreateSchema.partial();
