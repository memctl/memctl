import { sqliteTable, text, integer, unique, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  avatarUrl: text("avatar_url"),
  githubId: text("github_id").unique(),
  onboardingCompleted: integer("onboarding_completed", { mode: "boolean" }).default(false),
  isAdmin: integer("is_admin", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  planId: text("plan_id").notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  projectLimit: integer("project_limit").notNull().default(3),
  memberLimit: integer("member_limit").notNull().default(1),
  companyName: text("company_name"),
  taxId: text("tax_id"),
  billingAddress: text("billing_address"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const organizationMembers = sqliteTable(
  "organization_members",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").notNull().default("member"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [unique().on(table.orgId, table.userId)],
);

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [unique().on(table.orgId, table.slug)],
);

export const memories = sqliteTable(
  "memories",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    key: text("key").notNull(),
    content: text("content").notNull(),
    metadata: text("metadata"),
    scope: text("scope").notNull().default("project"), // "project" | "shared"
    priority: integer("priority").default(0),
    tags: text("tags"), // JSON array of strings
    relatedKeys: text("related_keys"), // JSON array of related memory keys
    pinnedAt: integer("pinned_at", { mode: "timestamp" }),
    archivedAt: integer("archived_at", { mode: "timestamp" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    accessCount: integer("access_count").notNull().default(0),
    lastAccessedAt: integer("last_accessed_at", { mode: "timestamp" }),
    helpfulCount: integer("helpful_count").notNull().default(0),
    unhelpfulCount: integer("unhelpful_count").notNull().default(0),
    embedding: text("embedding"), // JSON-serialized Float32Array (nullable for backward compat)
    createdBy: text("created_by").references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    unique().on(table.projectId, table.key),
    index("memories_project_updated").on(table.projectId, table.updatedAt),
    index("memories_project_archived").on(table.projectId, table.archivedAt),
    index("memories_project_priority").on(table.projectId, table.priority),
    index("memories_project_created").on(table.projectId, table.createdAt),
  ],
);

export const memoryVersions = sqliteTable(
  "memory_versions",
  {
    id: text("id").primaryKey(),
    memoryId: text("memory_id")
      .notNull()
      .references(() => memories.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    content: text("content").notNull(),
    metadata: text("metadata"),
    changedBy: text("changed_by").references(() => users.id),
    changeType: text("change_type").notNull(), // "created" | "updated" | "restored"
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("memory_versions_memory_version").on(table.memoryId, table.version),
  ],
);

export const contextTypes = sqliteTable(
  "context_types",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    description: text("description").notNull(),
    schema: text("schema"), // optional JSON schema for validation
    icon: text("icon"), // optional icon name
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [unique().on(table.orgId, table.slug)],
);

export const sessionLogs = sqliteTable("session_logs", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  sessionId: text("session_id").notNull(),
  branch: text("branch"),
  summary: text("summary"),
  keysRead: text("keys_read"), // JSON array of memory keys accessed
  keysWritten: text("keys_written"), // JSON array of memory keys written
  toolsUsed: text("tools_used"), // JSON array of tool names used
  startedAt: integer("started_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  endedAt: integer("ended_at", { mode: "timestamp" }),
  createdBy: text("created_by").references(() => users.id),
});

export const activityLogs = sqliteTable(
  "activity_logs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    sessionId: text("session_id"),
    action: text("action").notNull(), // "tool_call" | "memory_read" | "memory_write" | "memory_delete"
    toolName: text("tool_name"),
    memoryKey: text("memory_key"),
    details: text("details"), // JSON object with extra info
    createdBy: text("created_by").references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("activity_session_action").on(table.sessionId, table.action),
    index("activity_project_action_created").on(table.projectId, table.action, table.createdAt),
  ],
);

export const memorySnapshots = sqliteTable("memory_snapshots", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  name: text("name").notNull(),
  description: text("description"),
  data: text("data").notNull(), // JSON: full snapshot of all memories
  memoryCount: integer("memory_count").notNull(),
  createdBy: text("created_by").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const memoryLocks = sqliteTable(
  "memory_locks",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    memoryKey: text("memory_key").notNull(),
    lockedBy: text("locked_by"), // session or agent identifier
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [unique().on(table.projectId, table.memoryKey)],
);

export const projectTemplates = sqliteTable("project_templates", {
  id: text("id").primaryKey(),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description"),
  data: text("data").notNull(), // JSON array of { key, content, metadata, priority, tags }
  isBuiltin: integer("is_builtin", { mode: "boolean" }).default(false),
  createdBy: text("created_by").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const webhookConfigs = sqliteTable("webhook_configs", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  url: text("url").notNull(),
  events: text("events"), // JSON array: ["memory_created","memory_updated","memory_deleted","snapshot_created"]
  digestIntervalMinutes: integer("digest_interval_minutes").notNull().default(60),
  lastSentAt: integer("last_sent_at", { mode: "timestamp" }),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  secret: text("secret"), // HMAC signing secret
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const webhookEvents = sqliteTable(
  "webhook_events",
  {
    id: text("id").primaryKey(),
    webhookConfigId: text("webhook_config_id")
      .notNull()
      .references(() => webhookConfigs.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    payload: text("payload").notNull(), // JSON
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    dispatchedAt: integer("dispatched_at", { mode: "timestamp" }),
  },
  (table) => [
    index("webhook_events_undispatched").on(table.webhookConfigId, table.dispatchedAt),
  ],
);

export const apiTokens = sqliteTable("api_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name"),
  tokenHash: text("token_hash").notNull(),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
});

export const onboardingResponses = sqliteTable("onboarding_responses", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  heardFrom: text("heard_from"),
  role: text("role"),
  teamSize: text("team_size"),
  useCase: text("use_case"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const changelogEntries = sqliteTable("changelog_entries", {
  id: text("id").primaryKey(),
  version: text("version").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary"),
  releaseDate: integer("release_date", { mode: "timestamp" }).notNull(),
  status: text("status").notNull().default("draft"),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const changelogItems = sqliteTable("changelog_items", {
  id: text("id").primaryKey(),
  entryId: text("entry_id")
    .notNull()
    .references(() => changelogEntries.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  description: text("description").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const verifications = sqliteTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

export const orgMemoryDefaults = sqliteTable(
  "org_memory_defaults",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id),
    key: text("key").notNull(),
    content: text("content").notNull(),
    metadata: text("metadata"),
    priority: integer("priority").default(0),
    tags: text("tags"), // JSON array of strings
    createdBy: text("created_by").references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [unique().on(table.orgId, table.key)],
);

export const orgInvitations = sqliteTable(
  "org_invitations",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id),
    email: text("email").notNull(),
    role: text("role").notNull().default("member"),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => users.id),
    acceptedAt: integer("accepted_at", { mode: "timestamp" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    unique().on(table.orgId, table.email),
    index("org_invitations_email").on(table.email),
  ],
);

export const projectMembers = sqliteTable(
  "project_members",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [unique().on(table.projectId, table.userId)],
);

export const promoCodes = sqliteTable(
  "promo_codes",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    description: text("description"),
    campaign: text("campaign"),
    stripeCouponId: text("stripe_coupon_id").notNull(),
    stripePromoCodeId: text("stripe_promo_code_id").notNull(),
    discountType: text("discount_type").notNull(), // "percent" | "fixed"
    discountAmount: integer("discount_amount").notNull(), // percentage (50) or cents (500 = $5.00)
    currency: text("currency").default("usd"),
    duration: text("duration").notNull(), // "once" | "repeating" | "forever"
    durationInMonths: integer("duration_in_months"), // only when duration = "repeating"
    applicablePlans: text("applicable_plans"), // JSON array of plan IDs, null = all plans
    minimumPlanTier: text("minimum_plan_tier"), // min plan code works on
    restrictedToOrgs: text("restricted_to_orgs"), // JSON array of org IDs, null = any org
    maxRedemptions: integer("max_redemptions"), // total cap, null = unlimited
    maxRedemptionsPerOrg: integer("max_redemptions_per_org").default(1),
    firstSubscriptionOnly: integer("first_subscription_only", { mode: "boolean" }).default(false),
    noPreviousPromo: integer("no_previous_promo", { mode: "boolean" }).default(false),
    startsAt: integer("starts_at", { mode: "timestamp" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    active: integer("active", { mode: "boolean" }).default(true),
    timesRedeemed: integer("times_redeemed").notNull().default(0),
    totalDiscountGiven: integer("total_discount_given").notNull().default(0),
    createdBy: text("created_by").references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("promo_codes_code").on(table.code),
    index("promo_codes_active").on(table.active),
    index("promo_codes_campaign").on(table.campaign),
    index("promo_codes_created_at").on(table.createdAt),
  ],
);

export const promoRedemptions = sqliteTable(
  "promo_redemptions",
  {
    id: text("id").primaryKey(),
    promoCodeId: text("promo_code_id")
      .notNull()
      .references(() => promoCodes.id),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    planId: text("plan_id").notNull(),
    discountApplied: integer("discount_applied").notNull(),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    redeemedAt: integer("redeemed_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("promo_redemptions_promo_code_id").on(table.promoCodeId),
    index("promo_redemptions_org_id").on(table.orgId),
    index("promo_redemptions_promo_org").on(table.promoCodeId, table.orgId),
  ],
);

export const blogPosts = sqliteTable("blog_posts", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  excerpt: text("excerpt"),
  content: text("content").notNull(),
  coverImageUrl: text("cover_image_url"),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id),
  status: text("status").notNull().default("draft"),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
