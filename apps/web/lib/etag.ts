import { createHash } from "node:crypto";
import { NextRequest } from "next/server";

export function generateETag(body: string): string {
  const hash = createHash("md5").update(body).digest("hex");
  return `"${hash}"`;
}

export function checkConditional(req: NextRequest, etag: string): boolean {
  const ifNoneMatch = req.headers.get("if-none-match");
  if (!ifNoneMatch) return false;
  return ifNoneMatch === etag || ifNoneMatch === `W/${etag}`;
}
