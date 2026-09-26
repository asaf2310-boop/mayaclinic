# OfirBaby Owner Admin App — Architecture & Plan

## Architecture summary (from live code + production probes)

### 1) Appointment management — `mayaclinic` (this repo)

| Area | Detail |
|------|--------|
| **URLs** | Public booking: `https://www.ofirbaby.com/booking/*`. Admin: `/booking/admin`. API: `/booking/api/admin`. |
| **Frontend** | Vite + React 18 + React Router + TanStack Query + Tailwind. Hebrew RTL. |
| **Backend** | Vercel serverless handlers under `api/` (`admin.js`, `public-data.js`, Pelecard, email). Shared logic in `server/`. |
| **Database** | Supabase project `furrjspvtmyvjikynkfj`. Tables: `appointments`, `treatments`, `availability`, `weekly_schedule`, `patient_profiles`, `gift_vouchers`, Pelecard sessions. Multi-tenant via `tenant_id` (OfirBaby host → `maya`). Anon locked; admin uses service role on the server. |
| **Auth** | Custom HMAC session cookie `admin_session` (HttpOnly, Secure, SameSite=Lax, 12h). Password (`ADMIN_ACCESS_PASSWORD`) and/or Google OAuth allowlist (`ADMIN_EMAILS`). Enforced in `/api/admin` before any entity mutation. |
| **Admin capabilities** | Appointments list/filter by status; edit fields; status (pending/confirmed/cancelled/completed); paid toggle; delete; Meridian ID verify. Availability calendar + weekly schedule. Treatments CRUD. Customers + patient profiles. Revenue report. Gift vouchers list (read-only). |
| **Deployment** | GitHub `asaf2310-boop/mayaclinic` → Vercel; mounted under `/booking` on ofirbaby.com. |

### 2) Website management — separate Next.js app (source not in this workspace)

| Area | Detail |
|------|--------|
| **URLs** | Site: `https://www.ofirbaby.com`. Admin: `/admin` (login, pages, media, site). |
| **Frontend** | Next.js App Router (Turbopack build), Hebrew RTL, Heebo/Bellefair. |
| **Auth** | **Separate** email+password form via Next.js Server Actions (`$ACTION_ID_…`). Forgot/reset password routes. Not the booking cookie. |
| **Database** | Different Supabase project (`famjpsewerxnmihwgpgv` in CSP). Not the booking DB. |
| **APIs** | No public CMS REST surface found. Content edits go through Server Actions. Public: `/api/analytics/events`, `/api/analytics/ingest` only. |
| **Admin routes (exist when authenticated)** | `/admin`, `/admin/pages` (+ page slugs), `/admin/media`, `/admin/site` (+ general/seo/navigation). |
| **Repo** | Referenced as `ofirbaby-website` in booking env comments; **not available** under accessible GitHub remotes for this agent. |

### Auth relationship

**Separate systems.** Booking = HMAC cookie on `/booking` path + password/Google. Website = Next.js session + email/password on another Supabase project. Unifying them safely requires the website source, a shared identity provider, and coordinated cookie/CORS changes — a real auth migration. **Not done in this work.** The app uses booking password → bearer token for native Appointments, and an in-app WebView for Website (user signs into the existing website admin once; cookies stay in the WebView).

---

## Implementation plan

1. **Mobile framework:** Expo (React Native) — matches React stack; no Flutter/Kotlin codebase exists.
2. **Backend additive change (booking only):** Accept `Authorization: Bearer <admin_session_token>` alongside the cookie; `POST action=login` may return `{ token }` for mobile clients. Same HMAC secret and permissions. No service-role keys in the app.
3. **Native Appointments tab:** Login, calendar/day list, detail, edit, status, paid, cancel/delete confirm, availability, treatments, customers, gift vouchers — all via `/booking/api/admin`.
4. **Website tab (temporary WebView):** Load `https://www.ofirbaby.com/admin` so publishing/validation stay server-side. **Why WebView:** website source and CMS APIs are not in this repo; reverse-engineering Server Actions would be fragile and unsafe.
5. **Secure storage:** `expo-secure-store` for the booking token. RTL Hebrew UI, loading/error/confirmations.
6. **Deliverable:** Installable Android APK (local release/debug signing). No Play Store publish. No public booking/website UX changes.

## Out of scope / follow-ups

- Full unified SSO across booking + website (needs website repo).
- Native website CMS screens (needs authenticated CMS API from website repo).
- Google OAuth in native app (web redirect flow; password token covers day-to-day).
