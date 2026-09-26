# Verification status (do not treat as production-ready)

Last updated: 2026-09-26

## Blocking deploy dependency

Production `https://www.ofirbaby.com/booking/api/admin` does **not** yet return a mobile Bearer token.
The APK cannot complete real owner login against production until this PR’s backend is merged and redeployed.

Must deploy before production use:
- `server/adminSession.js`
- `api/admin.js`

See `SECURITY_AND_DEPLOY.md`.

## Appointment actions tested on Android emulator

Test target: local mock API (`scripts/mobile-admin-mock.mjs`) via `http://10.0.2.2:8787/api/admin`  
Device: Android API 35 emulator (`ofirbaby_api35`)  
APK: signed with Android **Debug** keystore (sideloadable; not Play Store)

| Action | Result | Evidence |
|--------|--------|----------|
| Login (Bearer token) | **PASS** (mock) | `e2e_01_login_mock.png`, then appointments |
| View appointments (day list + filters UI) | **PASS** | `e2e_02_appointments_list.png` |
| Open appointment details | **PASS** | `e2e_03_appointment_detail.png` |
| Edit + save appointment | **PASS** | Save dialog “התור עודכן בהצלחה”; status became הושלם (`e2e_33_saved_back.png` / `e2e_45_*` dialog) |
| Change status (list confirm/cancel + detail chips) | **PASS** (detail save to הושלם); list confirm/cancel UI present (`e2e_02`) | |
| Availability view | **PASS** | `e2e_05_availability.png` |
| Availability edit/save | **PARTIAL** | View + day UI verified; slot save UI automation flaky. Same `/api/admin` create/update path used by app verified via Bearer against mock |
| Treatments list | **PASS** | `e2e_04_treatments.png` |
| Treatment create | **PASS** | `MobileTest` appeared; `e2e_10_treatment_created.png` |

Production appointment E2E: **NOT RUN** (login blocked until deploy).

## Website WebView on Android

| Check | Result |
|-------|--------|
| Website tab opens | **PASS** |
| Existing `/admin` login page renders (email/password, forgot password) | **PASS** — `e2e_06_website_webview_login.png` |
| Successful website login | **NOT VERIFIED** — no website admin credentials in this environment |
| Media upload | **NOT VERIFIED** — requires authenticated session |
| Content edit + publish | **NOT VERIFIED** — requires authenticated session |
| Session persistence in WebView | **NOT VERIFIED** across relaunch |
| Layout notes | Login form fits phone; native bottom nav overlays below WebView. WebView content mostly opaque to accessibility services. File picker / camera for media untested. |

**This WebView is a temporary bridge, not a completed native CMS.**

## Access needed to replace WebView with native website screens

1. **Git access** to the `ofirbaby-website` repository (read at minimum; write if new mobile API routes are added there).
2. **Documented authenticated API** for CMS operations currently done via Next.js Server Actions, e.g.:
   - session create/check/logout
   - list/get/update page content
   - media list/upload/delete
   - site settings / SEO / navigation
   - publish + validation error payloads (same rules as web)
3. **Auth decision**: shared identity with booking vs dual login vs SSO. Prefer explicit mobile-safe token (Bearer) without embedding service-role keys.
4. **Staging environment** with non-production content + test admin user.
5. **Sample payloads / schema** for pages/media/settings as stored in Supabase `famjpsewerxnmihwgpgv` (or whatever the website uses).

Without (1)+(2), native website management cannot safely preserve publish/validation behavior.

## APK signing & distribution

- Package: `com.ofirbaby.admin`
- Signing: **Android Debug** cert (`CN=Android Debug`) — installable via sideload (“install unknown apps”), **not** Play-ready.
- Downloadable artifact (Cursor artifacts): `ofirbaby-admin-release.apk`
- Rebuild: `cd mobile && npm run build:apk`

## Remaining gaps → practical sequence

1. **Merge & deploy** booking Bearer backend (`api/admin.js`, `server/adminSession.js`) to ofirbaby `/booking` Vercel — smoke mobile login + web cookie login.
2. **Install production-configured APK**; verify appointments against real data (login, list, edit, status, availability, treatments) on a physical phone.
3. **Owner tests Website WebView** with real website credentials (login, media upload, edit, publish); note any mobile layout issues.
4. **Grant website repo + CMS API access**; design mobile endpoints reusing Server Action validation.
5. Replace Website WebView with native screens incrementally (pages → media → site settings).
6. Optional: Google OAuth for mobile, Meridian verify UI, revenue export, weekly schedule template, Play signing.
