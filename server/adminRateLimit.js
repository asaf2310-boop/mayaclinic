/**
 * Best-effort in-memory login throttle for serverless.
 * Not a global store — still raises the cost of password spraying.
 */

const attemptsByKey = new Map();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const LOCK_MS = 15 * 60 * 1000;

function getClientKey(req) {
  const forwarded = String(req?.headers?.["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  const realIp = String(req?.headers?.["x-real-ip"] || "").trim();
  return forwarded || realIp || "unknown";
}

function prune(now) {
  for (const [key, value] of attemptsByKey.entries()) {
    if (value.lockedUntil && value.lockedUntil < now && value.windowStart < now - WINDOW_MS) {
      attemptsByKey.delete(key);
    }
  }
}

export function getAdminLoginThrottle(req) {
  prune(Date.now());
  const key = getClientKey(req);
  const now = Date.now();
  const current = attemptsByKey.get(key);

  if (current?.lockedUntil && current.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((current.lockedUntil - now) / 1000),
      key,
    };
  }

  return { allowed: true, retryAfterSec: 0, key };
}

export function recordAdminLoginFailure(req) {
  const key = getClientKey(req);
  const now = Date.now();
  const current = attemptsByKey.get(key) || { count: 0, windowStart: now, lockedUntil: 0 };

  if (now - current.windowStart > WINDOW_MS) {
    current.count = 0;
    current.windowStart = now;
    current.lockedUntil = 0;
  }

  current.count += 1;
  if (current.count >= MAX_ATTEMPTS) {
    current.lockedUntil = now + LOCK_MS;
  }
  attemptsByKey.set(key, current);
  return current;
}

export function clearAdminLoginFailures(req) {
  attemptsByKey.delete(getClientKey(req));
}
