/** Shared claim-before-send helpers (no Supabase imports — avoids cycles). */

export const STALE_EMAIL_CLAIM_MS = 15 * 60 * 1000;

/**
 * Pure eligibility for claim-before-send (mirrors PostgREST claim filters).
 * Concurrent workers: only one conditional UPDATE matches while status stays claimable.
 * Stale `sending` may be reclaimed; fresh `sending` must not.
 */
export function canClaimEmailDelivery(
  { status, claimedAt = null, sentAt = null } = {},
  now = new Date()
) {
  if (sentAt) return false;
  const s = String(status || "");
  if (!s || s === "pending" || s === "temporary_failure") return true;
  if (s === "sending") {
    if (!claimedAt) return true;
    const claimedMs = new Date(claimedAt).getTime();
    if (!Number.isFinite(claimedMs)) return true;
    return claimedMs < now.getTime() - STALE_EMAIL_CLAIM_MS;
  }
  return false;
}

/**
 * PostgREST `or=(...)` filter for atomic claim PATCH.
 * Timestamp is double-quoted so `.` in fractional seconds is not parsed as syntax.
 */
export function buildEmailClaimOrFilter(statusColumn, claimedAtColumn, now = new Date()) {
  const staleBefore = new Date(now.getTime() - STALE_EMAIL_CLAIM_MS).toISOString();
  return (
    `or=(${statusColumn}.is.null,` +
    `${statusColumn}.in.(pending,temporary_failure),` +
    `and(${statusColumn}.eq.sending,${claimedAtColumn}.lt."${staleBefore}"),` +
    `and(${statusColumn}.eq.sending,${claimedAtColumn}.is.null))`
  );
}
