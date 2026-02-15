import { SignJWT, jwtVerify } from "jose";
import { LRUCache } from "lru-cache";

const secret = new TextEncoder().encode(
  process.env.BETTER_AUTH_SECRET ?? "development-secret-change-me",
);

interface CachedSession {
  valid: boolean;
  userId: string;
  orgId: string;
}

const sessionCache = new LRUCache<string, CachedSession>({
  max: 1000,
  ttl: 5 * 60 * 1000, // 5 minutes
});

export async function createJwt(payload: {
  userId: string;
  orgId: string;
  sessionId: string;
}) {
  const jti = crypto.randomUUID();
  return new SignJWT({ ...payload, jti })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}

export async function verifyJwt(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as {
      userId: string;
      orgId: string;
      sessionId: string;
      jti: string;
      iat: number;
      exp: number;
    };
  } catch {
    return null;
  }
}

export function getCachedSession(jti: string) {
  return sessionCache.get(jti);
}

export function setCachedSession(jti: string, session: CachedSession) {
  sessionCache.set(jti, session);
}

export function invalidateCachedSession(jti: string) {
  sessionCache.delete(jti);
}
