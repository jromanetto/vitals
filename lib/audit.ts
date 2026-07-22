import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";

function extractIp(req?: Request): string | null {
  if (!req) return null;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = req.headers.get("x-real-ip");
  return xri || null;
}

/**
 * Record a security event (login, signup, rate limit, password reset, ...).
 *
 * Deliberately fire-and-forget with a sync signature: the 30 call sites sit on
 * request paths where an audit write must never add latency, and must never
 * fail the request it is describing. Errors are logged, not propagated.
 */
export function logAudit(action: string, target?: string | null, req?: Request): void {
  void convexServer()
    .mutation(api.audit.log, {
      secret: bridgeSecret(),
      action,
      target: target ?? undefined,
      ip: extractIp(req) ?? undefined,
      userAgent: req?.headers.get("user-agent") ?? undefined,
    })
    .catch((e) => console.error("[audit] log error:", e));
}

export type AuditRow = {
  id: number;
  action: string;
  target: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: number;
};

/** Async since the trail moved to Convex; both callers are server-side. */
export async function listAudit(limit = 50): Promise<AuditRow[]> {
  try {
    const { rows } = await convexServer().query(api.audit.list, {
      secret: bridgeSecret(),
      limit,
    });
    return rows;
  } catch (e) {
    console.error("[audit] list error:", e);
    return [];
  }
}
