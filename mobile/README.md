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

## Run (dev)

```bash
npx expo start
```

## Build Android APK (local)

Requires Android SDK + JDK. From `mobile/`:

```bash
npx expo prebuild --platform android --non-interactive
cd android
./gradlew assembleRelease
```

APK output:

```text
android/app/build/outputs/apk/release/app-release.apk
```

Or use the helper script from repo root / `mobile`:

```bash
npm run build:apk
```

## Sign-in

1. **Appointments** — booking admin password (`ADMIN_ACCESS_PASSWORD` on the booking backend). Session token stored in Expo SecureStore; API calls use `Authorization: Bearer`.
2. **Website** — existing website admin email/password inside the Website tab WebView (separate auth system).

No admin secrets are embedded in the app.
