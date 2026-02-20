import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError, checkRateLimit } from "@/lib/api-middleware";

interface BatchOperation {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
}

interface BatchResult {
  status: number;
  body: unknown;
}

const MAX_OPERATIONS = 20;

/**
 * POST /api/v1/batch
 *
 * Execute multiple API operations in a single request.
 * Body: { operations: [{ method, path, body? }, ...] }
 * Returns: { results: [{ status, body }, ...] }
 */
export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const rateLimitRes = await checkRateLimit(authResult);
  if (rateLimitRes) return rateLimitRes;

  const payload = await req.json().catch(() => null);
  if (!payload || !Array.isArray(payload.operations)) {
    return jsonError("Body must have operations (array)", 400);
  }

  const operations = payload.operations as BatchOperation[];
  if (operations.length === 0) {
    return jsonError("operations array must not be empty", 400);
  }
  if (operations.length > MAX_OPERATIONS) {
    return jsonError(`Maximum ${MAX_OPERATIONS} operations per batch`, 400);
  }

  // Validate each operation
  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    if (!op.method || !op.path) {
      return jsonError(`Operation ${i}: method and path are required`, 400);
    }
    if (!["GET", "POST", "PATCH", "DELETE"].includes(op.method)) {
      return jsonError(`Operation ${i}: method must be GET, POST, PATCH, or DELETE`, 400);
    }
    if (!op.path.startsWith("/")) {
      return jsonError(`Operation ${i}: path must start with /`, 400);
    }
  }

  // Forward headers from the original request
  const forwardHeaders = new Headers();
  forwardHeaders.set("Authorization", req.headers.get("authorization") ?? "");
  forwardHeaders.set("Content-Type", "application/json");
  const orgSlug = req.headers.get("x-org-slug");
  const projectSlug = req.headers.get("x-project-slug");
  if (orgSlug) forwardHeaders.set("X-Org-Slug", orgSlug);
  if (projectSlug) forwardHeaders.set("X-Project-Slug", projectSlug);

  // Determine the base URL from this request
  const url = new URL(req.url);
  const baseUrl = `${url.protocol}//${url.host}/api/v1`;

  // Execute all operations in parallel
  const results: BatchResult[] = await Promise.all(
    operations.map(async (op): Promise<BatchResult> => {
      try {
        const fetchUrl = `${baseUrl}${op.path}`;
        const res = await fetch(fetchUrl, {
          method: op.method,
          headers: forwardHeaders,
          body: op.body && op.method !== "GET" ? JSON.stringify(op.body) : undefined,
        });

        const body = await res.json().catch(() => null);
        return { status: res.status, body };
      } catch (err) {
        return {
          status: 500,
          body: { error: err instanceof Error ? err.message : "Internal error" },
        };
      }
    }),
  );

  return NextResponse.json({ results });
}
