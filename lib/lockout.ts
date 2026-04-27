/**
 * In-memory lockout counter for login attempts. Reset on success.
 * Threshold: 5 failures in 10 min → 429 for 10 min.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 5;
const LOCK_MS = 10 * 60 * 1000;

type Bucket = { fails: number; firstFailAt: number; lockedUntil: number };
const buckets = new Map<string, Bucket>();

function key(email: string, ip: string | null): string {
  return `${(email || "").toLowerCase()}::${ip || ""}`;
}

export function isLocked(email: string, ip: string | null): { locked: boolean; retryAfter: number } {
  const b = buckets.get(key(email, ip));
  if (!b) return { locked: false, retryAfter: 0 };
  if (b.lockedUntil > Date.now()) return { locked: true, retryAfter: Math.ceil((b.lockedUntil - Date.now()) / 1000) };
  return { locked: false, retryAfter: 0 };
}

export function recordFail(email: string, ip: string | null) {
  const k = key(email, ip);
  const now = Date.now();
  let b = buckets.get(k);
  if (!b || now - b.firstFailAt > WINDOW_MS) {
    b = { fails: 1, firstFailAt: now, lockedUntil: 0 };
  } else {
    b.fails += 1;
    if (b.fails >= MAX_FAILS) b.lockedUntil = now + LOCK_MS;
  }
  buckets.set(k, b);
}

export function recordSuccess(email: string, ip: string | null) {
  buckets.delete(key(email, ip));
}

export function extractIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

// Sweep old entries every 5 min
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets.entries()) {
      if (b.lockedUntil < now && now - b.firstFailAt > WINDOW_MS) buckets.delete(k);
    }
  }, 5 * 60 * 1000).unref?.();
}
