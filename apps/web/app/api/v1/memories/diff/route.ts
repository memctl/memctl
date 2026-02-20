import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { memories, memoryVersions } from "@memctl/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { resolveOrgAndProject } from "../capacity-utils";

/**
 * GET /api/v1/memories/diff?key=...&v1=...&v2=...
 *
 * Returns a line-by-line diff between two versions of a memory.
 * If v2 is omitted, diffs against the current content.
 */
export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgSlug = req.headers.get("x-org-slug");
  const projectSlug = req.headers.get("x-project-slug");

  if (!orgSlug || !projectSlug) {
    return jsonError("X-Org-Slug and X-Project-Slug headers are required", 400);
  }

  const context = await resolveOrgAndProject(orgSlug, projectSlug, authResult.userId);
  if (!context) return jsonError("Project not found", 404);

  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const v1 = url.searchParams.get("v1");
  const v2 = url.searchParams.get("v2");

  if (!key || !v1) {
    return jsonError("key and v1 query params are required", 400);
  }

  const [memory] = await db
    .select()
    .from(memories)
    .where(
      and(eq(memories.projectId, context.project.id), eq(memories.key, key)),
    )
    .limit(1);

  if (!memory) return jsonError("Memory not found", 404);

  // Get version v1
  const [version1] = await db
    .select()
    .from(memoryVersions)
    .where(
      and(
        eq(memoryVersions.memoryId, memory.id),
        eq(memoryVersions.version, parseInt(v1)),
      ),
    )
    .limit(1);

  if (!version1) return jsonError(`Version ${v1} not found`, 404);

  // Get version v2 or current content
  let contentB: string;
  let versionB: string;

  if (v2) {
    const [version2] = await db
      .select()
      .from(memoryVersions)
      .where(
        and(
          eq(memoryVersions.memoryId, memory.id),
          eq(memoryVersions.version, parseInt(v2)),
        ),
      )
      .limit(1);

    if (!version2) return jsonError(`Version ${v2} not found`, 404);
    contentB = version2.content;
    versionB = `v${v2}`;
  } else {
    contentB = memory.content;
    versionB = "current";
  }

  const diff = computeLineDiff(version1.content, contentB);

  return NextResponse.json({
    key,
    from: `v${v1}`,
    to: versionB,
    diff,
    summary: {
      added: diff.filter((l) => l.type === "add").length,
      removed: diff.filter((l) => l.type === "remove").length,
      unchanged: diff.filter((l) => l.type === "same").length,
    },
  });
}

interface DiffLine {
  type: "add" | "remove" | "same";
  line: string;
  lineNumber?: number;
}

function computeLineDiff(a: string, b: string): DiffLine[] {
  const linesA = a.split("\n");
  const linesB = b.split("\n");
  const result: DiffLine[] = [];

  // Simple LCS-based diff
  const m = linesA.length;
  const n = linesB.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (linesA[i - 1] === linesB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  let i = m;
  let j = n;
  const reversed: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      reversed.push({ type: "same", line: linesA[i - 1], lineNumber: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      reversed.push({ type: "add", line: linesB[j - 1], lineNumber: j });
      j--;
    } else {
      reversed.push({ type: "remove", line: linesA[i - 1], lineNumber: i });
      i--;
    }
  }

  for (let k = reversed.length - 1; k >= 0; k--) {
    result.push(reversed[k]);
  }

  return result;
}
