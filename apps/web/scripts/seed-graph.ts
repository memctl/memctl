/**
 * Seed script that populates a dev project with interconnected memories
 * so the Graph tab has data to visualize.
 *
 * Usage:
 *   pnpm db:seed-graph
 *   pnpm db:seed-graph my-project    # target a specific project slug
 *
 * Requires DEV_AUTH_BYPASS=true or an existing org/project in the database.
 * Finds the first available project (or the named one) and inserts ~30
 * memories with relatedKeys forming several clusters plus a few orphans.
 */

import { db } from "../lib/db";
import { organizations, projects, memories } from "@memctl/db/schema";
import { eq, and } from "drizzle-orm";

function id() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
}

interface SeedMemory {
  key: string;
  content: string;
  priority: number;
  tags: string[];
  relatedKeys: string[];
  pinned?: boolean;
  accessCount?: number;
}

// Three clusters + a few orphans
const SEED_MEMORIES: SeedMemory[] = [
  // ── Cluster 1: Architecture & project structure (8 nodes) ────────────
  {
    key: "architecture/overview",
    content: "The system uses a modular monorepo with shared packages for database, types, and CLI tooling. Next.js serves both the dashboard and REST API.",
    priority: 90,
    tags: ["architecture", "overview"],
    relatedKeys: ["architecture/api-layer", "architecture/database", "architecture/auth"],
    pinned: true,
    accessCount: 42,
  },
  {
    key: "architecture/api-layer",
    content: "API routes follow a middleware chain: withApiMiddleware -> authenticateRequest -> requireOrgMembership -> checkProjectAccess -> handler. All responses use { result, error } shape.",
    priority: 80,
    tags: ["architecture", "api"],
    relatedKeys: ["architecture/overview", "architecture/auth", "patterns/error-handling"],
    accessCount: 28,
  },
  {
    key: "architecture/database",
    content: "Turso (libSQL) with Drizzle ORM. 24 tables. Migrations generated with drizzle-kit. Dev uses local libSQL on port 8080.",
    priority: 85,
    tags: ["architecture", "database"],
    relatedKeys: ["architecture/overview", "conventions/schema-changes"],
    accessCount: 35,
  },
  {
    key: "architecture/auth",
    content: "better-auth with GitHub OAuth, magic link, and dev bypass mode. Cookie-based sessions for dashboard, Bearer tokens for API.",
    priority: 75,
    tags: ["architecture", "auth"],
    relatedKeys: ["architecture/overview", "architecture/api-layer"],
    accessCount: 19,
  },
  {
    key: "architecture/cli",
    content: "The memctl npm package runs as an MCP server by default. 11 tools, 7 resources, 3 prompts. Config lives at ~/.memctl/config.json.",
    priority: 70,
    tags: ["architecture", "cli"],
    relatedKeys: ["architecture/overview"],
    accessCount: 12,
  },
  {
    key: "conventions/schema-changes",
    content: "Always run db:generate after schema changes, then db:migrate. Never manually edit migration files.",
    priority: 60,
    tags: ["conventions", "database"],
    relatedKeys: ["architecture/database"],
    accessCount: 8,
  },
  {
    key: "patterns/error-handling",
    content: "Use early returns for validation errors. API routes return 4xx with { error: string }. Internal errors log to console and return 500.",
    priority: 55,
    tags: ["patterns", "api"],
    relatedKeys: ["architecture/api-layer", "patterns/validation"],
    accessCount: 15,
  },
  {
    key: "patterns/validation",
    content: "Zod schemas validate all external input. Shared validators live in @memctl/shared. API routes parse request body with z.object().parse().",
    priority: 65,
    tags: ["patterns", "validation"],
    relatedKeys: ["patterns/error-handling", "architecture/api-layer"],
    accessCount: 11,
  },

  // ── Cluster 2: Frontend & design (7 nodes) ──────────────────────────
  {
    key: "design/theme",
    content: "Dark theme with CSS custom properties. Accent color #F97316 (orange). Dense, terminal-like aesthetic with mono fonts and tight spacing.",
    priority: 80,
    tags: ["design", "frontend"],
    relatedKeys: ["design/components", "design/responsive", "design/empty-states"],
    pinned: true,
    accessCount: 30,
  },
  {
    key: "design/components",
    content: "UI primitives from shadcn/ui in @/components/ui/. Icons from lucide-react. Animations from motion (framer-motion).",
    priority: 70,
    tags: ["design", "components"],
    relatedKeys: ["design/theme", "design/tables"],
    accessCount: 22,
  },
  {
    key: "design/responsive",
    content: "All layouts work 320px+. Sidebar hidden on mobile, shown in Sheet drawer. Responsive padding: px-4 py-4 md:px-8 md:py-6.",
    priority: 75,
    tags: ["design", "responsive"],
    relatedKeys: ["design/theme", "design/tables"],
    accessCount: 18,
  },
  {
    key: "design/tables",
    content: "Tables with >4 columns wrap in overflow-x-auto. Hide columns progressively: hidden sm:table-cell, hidden md:table-cell.",
    priority: 50,
    tags: ["design", "tables"],
    relatedKeys: ["design/responsive", "design/components"],
    accessCount: 9,
  },
  {
    key: "design/empty-states",
    content: "Every empty state needs a lucide icon, short message, and hint text when caused by filters. Use dash-card container.",
    priority: 45,
    tags: ["design", "ux"],
    relatedKeys: ["design/theme"],
    accessCount: 6,
  },
  {
    key: "design/loading",
    content: "Skeletons during filter changes. Pulsing dots for infinite scroll. No spinners except in button loading states.",
    priority: 40,
    tags: ["design", "ux"],
    relatedKeys: ["design/components"],
    accessCount: 4,
  },
  {
    key: "design/forms",
    content: "Forms use controlled inputs. Validation errors shown inline below fields. Submit buttons disable during pending state.",
    priority: 50,
    tags: ["design", "forms"],
    relatedKeys: ["design/components", "patterns/validation"],
    accessCount: 7,
  },

  // ── Cluster 3: Testing & CI (5 nodes) ───────────────────────────────
  {
    key: "testing/strategy",
    content: "Unit tests with vitest. No E2E tests yet. Focus on API route handlers and shared utility functions.",
    priority: 60,
    tags: ["testing"],
    relatedKeys: ["testing/running", "testing/mocks", "ci/pipeline"],
    accessCount: 14,
  },
  {
    key: "testing/running",
    content: "Run tests with: npx vitest run. Watch mode: npx vitest. Filter by file: npx vitest run api-client.",
    priority: 55,
    tags: ["testing", "commands"],
    relatedKeys: ["testing/strategy"],
    accessCount: 20,
  },
  {
    key: "testing/mocks",
    content: "Mock database calls with vi.mock. Use factory functions for test data. Never hit real APIs in tests.",
    priority: 50,
    tags: ["testing", "mocks"],
    relatedKeys: ["testing/strategy"],
    accessCount: 8,
  },
  {
    key: "ci/pipeline",
    content: "GitHub Actions: lint -> typecheck -> test -> build. Runs on push to main and PRs. CLI auto-publishes on version bump.",
    priority: 65,
    tags: ["ci", "pipeline"],
    relatedKeys: ["testing/strategy", "ci/checks"],
    accessCount: 16,
  },
  {
    key: "ci/checks",
    content: "Pre-merge checks: ESLint must pass, tsc --noEmit clean, all vitest tests green. Build step verifies Docker image.",
    priority: 55,
    tags: ["ci"],
    relatedKeys: ["ci/pipeline"],
    accessCount: 10,
  },

  // ── Cross-cluster bridge ────────────────────────────────────────────
  {
    key: "workflow/dev-setup",
    content: "Clone repo, pnpm install, cp .env.example .env, docker compose up, docker compose exec web pnpm db:push. Dashboard at localhost:3000.",
    priority: 70,
    tags: ["workflow", "setup"],
    relatedKeys: ["architecture/database", "design/theme", "testing/running"],
    accessCount: 25,
  },

  // ── Orphan nodes (no relationships) ─────────────────────────────────
  {
    key: "notes/performance-ideas",
    content: "Consider adding Redis caching for hot memory lookups. Benchmark before and after. Low priority until scale issues appear.",
    priority: 20,
    tags: ["notes", "performance"],
    relatedKeys: [],
    accessCount: 2,
  },
  {
    key: "notes/migration-plan",
    content: "Potential migration from libSQL to PostgreSQL for production. Need to evaluate Drizzle PG adapter compatibility.",
    priority: 15,
    tags: ["notes", "database"],
    relatedKeys: [],
    accessCount: 1,
  },
  {
    key: "scratch/meeting-notes-feb",
    content: "Discussed roadmap priorities. Graph visualization, memory versioning UI, and team activity dashboard are top 3.",
    priority: 10,
    tags: ["scratch"],
    relatedKeys: [],
    accessCount: 0,
  },
  {
    key: "notes/docker-tips",
    content: "Use docker compose exec web sh to get a shell. Logs: docker compose logs -f web. Rebuild after dependency changes: docker compose build.",
    priority: 30,
    tags: ["notes", "docker"],
    relatedKeys: [],
    accessCount: 5,
  },
  {
    key: "conventions/naming",
    content: "Kebab-case filenames, camelCase exports. Named exports only, no default exports. Prefix unused vars with underscore.",
    priority: 50,
    tags: ["conventions"],
    relatedKeys: [],
    accessCount: 7,
  },
];

async function seed() {
  const targetSlug = process.argv[2];

  // Find the target project
  let project: { id: string; slug: string; orgId: string } | undefined;

  if (targetSlug) {
    const [p] = await db
      .select({ id: projects.id, slug: projects.slug, orgId: projects.orgId })
      .from(projects)
      .where(eq(projects.slug, targetSlug))
      .limit(1);
    project = p;
    if (!project) {
      console.error(`Project with slug "${targetSlug}" not found.`);
      process.exit(1);
    }
  } else {
    // Find via dev-org, or fall back to first project
    const orgSlug =
      process.env.DEV_AUTH_BYPASS_ORG_SLUG ??
      process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS_ORG_SLUG ??
      "dev-org";

    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, orgSlug))
      .limit(1);

    if (org) {
      const [p] = await db
        .select({ id: projects.id, slug: projects.slug, orgId: projects.orgId })
        .from(projects)
        .where(eq(projects.orgId, org.id))
        .limit(1);
      project = p;
    }

    if (!project) {
      const [p] = await db
        .select({ id: projects.id, slug: projects.slug, orgId: projects.orgId })
        .from(projects)
        .limit(1);
      project = p;
    }
  }

  if (!project) {
    console.error(
      "No project found. Create an org and project first (run the dev server and complete onboarding).",
    );
    process.exit(1);
  }

  console.log(`Seeding graph data into project "${project.slug}" (${project.id})`);

  // Check for existing seed data to avoid duplicates
  const existing = await db
    .select({ key: memories.key })
    .from(memories)
    .where(
      and(
        eq(memories.projectId, project.id),
        eq(memories.key, SEED_MEMORIES[0].key),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    console.log("Seed data already exists. Deleting old seed memories first...");
    const seedKeys = SEED_MEMORIES.map((m) => m.key);
    for (const key of seedKeys) {
      await db
        .delete(memories)
        .where(
          and(eq(memories.projectId, project.id), eq(memories.key, key)),
        );
    }
    console.log(`Deleted ${seedKeys.length} old seed memories.`);
  }

  const now = new Date();
  let inserted = 0;

  for (const mem of SEED_MEMORIES) {
    // Stagger creation times so they look realistic
    const createdAt = new Date(now.getTime() - (SEED_MEMORIES.length - inserted) * 3_600_000);
    const lastAccessed = mem.accessCount
      ? new Date(now.getTime() - Math.random() * 7 * 86_400_000)
      : null;

    await db.insert(memories).values({
      id: id(),
      projectId: project.id,
      key: mem.key,
      content: mem.content,
      priority: mem.priority,
      tags: JSON.stringify(mem.tags),
      relatedKeys: JSON.stringify(mem.relatedKeys),
      pinnedAt: mem.pinned ? now : null,
      accessCount: mem.accessCount ?? 0,
      lastAccessedAt: lastAccessed,
      helpfulCount: Math.floor(Math.random() * (mem.accessCount ?? 0)),
      unhelpfulCount: Math.floor(Math.random() * 3),
      createdAt,
      updatedAt: new Date(createdAt.getTime() + Math.random() * 86_400_000),
    });
    inserted++;
  }

  console.log(`Inserted ${inserted} memories with graph relationships:`);
  console.log(`  - 3 clusters (architecture, design, testing/CI)`);
  console.log(`  - 1 bridge node connecting clusters`);
  console.log(`  - 5 orphan nodes (no relationships)`);
  console.log(`  - ${SEED_MEMORIES.reduce((n, m) => n + m.relatedKeys.length, 0)} total relationship links`);
  console.log(`\nOpen the project and click the Graph tab to see the visualization.`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
