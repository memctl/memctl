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
});

export const memoryUpdateSchema = z.object({
  content: z.string().min(1).max(65536).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const memorySearchSchema = z.object({
  query: z.string().min(1).max(256),
  limit: z.number().int().min(1).max(100).default(20),
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

export const planIdSchema = z.enum(PLAN_IDS);
