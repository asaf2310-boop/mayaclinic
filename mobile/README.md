# OfirBaby Owner Admin — Android app

Internal Expo (React Native) app for the OfirBaby business owner.
Combines booking admin (`/booking/admin`) and website admin (`/admin`).

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the inspected stack and auth tradeoffs.

## Setup

```bash
cd mobile
npm install
```

Optional: override API URLs in `app.json` → `expo.extra`:

- `bookingApiBase` (default `https://www.ofirbaby.com/booking/api/admin`)
- `websiteAdminUrl` (default `https://www.ofirbaby.com/admin`)

**Deploy note:** mobile login needs the booking backend change from this PR
(`Authorization: Bearer` + `client: "mobile"` token on password login) deployed to
Vercel before the APK can authenticate against production.

## Run (dev)

```bash
npx expo start
```

## Build Android APK (local)

Requires Android SDK + JDK. From `mobile/`:

```bash
npm run build:apk
```

APK outputs:

| Location | Path |
|----------|------|
| Gradle output | `mobile/android/app/build/outputs/apk/release/app-release.apk` |
| Convenience copy | `mobile/dist/ofirbaby-admin-release.apk` |

Signed with the Expo/Android debug release keystore for internal testing only. Not for Play Store.

## Sign-in

1. **Appointments** — booking admin password (`ADMIN_ACCESS_PASSWORD`). Token in Expo SecureStore; API uses `Authorization: Bearer`.
2. **Website** — existing website admin email/password inside the Website tab WebView (separate system).

No admin secrets are embedded in the app.

## Completed functions

### Appointments (native → production booking API)

- Secure password sign-in + session restore/logout
- Day calendar of appointments with status filters
- Open appointment details
- Edit patient/treatment/date/time/notes/status/paid/marketing
- Quick confirm / cancel (with confirmation) / paid toggle
- Delete appointment (with confirmation)
- Availability: browse month days, toggle slots, save
- Treatments: list / create / edit / delete
- Customers: aggregated from appointments + search
- Gift vouchers: list (read-only, matches web)

### Website

- Bottom-nav “אתר” opens `https://www.ofirbaby.com/admin` in an in-app WebView
- Preserves existing login, pages/media/site editing, and publish/validation

## Still requires work / follow-up

- **Deploy booking backend** so mobile bearer login works on production
- **Native website CMS** (needs `ofirbaby-website` source + authenticated CMS API)
- **Unified SSO** across booking + website (significant auth migration; deferred)
- **Google OAuth** inside the native app (web redirect today; password covers day-to-day)
- **Meridian treatment-ID verify** UI from web admin (not ported yet)
- **Revenue report** export (web-only for now)
- **Weekly schedule editor** (date availability is covered; recurring template UI not ported)
- **Play Store** packaging/signing (out of scope)
