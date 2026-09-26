# Bearer-token admin auth — security & compatibility review

## What changed (must merge + deploy)

| Path | Change |
|------|--------|
| `server/adminSession.js` | `getAdminSession()` also accepts `Authorization: Bearer <same HMAC token format as cookie>` |
| `api/admin.js` | Password login with `{ client: "mobile" }` returns `{ ok, token, expiresInSec }` in JSON; web login unchanged (`{ ok: true }` + Set-Cookie only) |
| `scripts/admin-mobile-token.test.mjs` | Unit coverage for bearer parse |

**Nothing else must be deployed for mobile Appointments.** Website backend is untouched.

## Compatibility with existing web admin

- Web `AdminLoginRequired` still POSTs `{ password }` (no `client`) → cookie-only response → **compatible**.
- Session cookie still set on successful password login for all clients.
- Google OAuth cookie flow unchanged.
- Entity CRUD still requires a valid session (cookie or bearer); same tenant resolution from host.
- Anonymous `GET action=session` still returns auth option flags without leaking allowlisted emails.

## Security assessment

| Topic | Finding |
|-------|---------|
| Secret material in APK | None. Password typed by user; token from server. |
| Token strength | Same HMAC-SHA256 construction as current HttpOnly cookie (`ADMIN_SESSION_SECRET` / fallbacks). |
| Token lifetime | 12h (`exp`), matching cookie Max-Age. |
| Token only for mobile | Hardened: token returned **only** when `client === "mobile"` (removed open `returnToken`). |
| Brute force | Existing login throttle still applies before token issuance. |
| Privilege | Bearer grants the same admin entity permissions as cookie; no new roles. |
| Storage on device | Expo SecureStore (Android Keystore-backed). Not HttpOnly (impossible for native Bearer). |
| CSRF | N/A for Bearer; cookie path still SameSite=Lax Secure. |
| Residual risk | Stolen device / extracted SecureStore token usable until expiry (same class as stolen session cookie). No server-side revoke list (same as today). |

## Deploy gate (blocking)

Until this PR’s backend files are merged to `main` and **redeployed on the ofirbaby.com /booking Vercel deployment**:

1. Production `POST .../api/admin?action=login` with `client:"mobile"` will **not** return a token.
2. The production-pointing APK **cannot log in**.
3. Do **not** treat the app as ready for owner use against production.

Suggested deploy order:
1. Merge/deploy **only** `server/adminSession.js` + `api/admin.js` (or the whole PR).
2. Smoke: `POST /booking/api/admin?action=login` with `{password, client:"mobile"}` → 200 + `token`.
3. Smoke: web `/booking/admin` password login still works (cookie).
4. Install production-configured APK and verify login.

## Not changing in production without explicit approval

- No Vercel env var changes required if `ADMIN_ACCESS_PASSWORD` + `ADMIN_SESSION_SECRET` already set.
- No Supabase schema changes.
- No website (`ofirbaby.com` Next.js) deploy.
- No public booking UX changes.
