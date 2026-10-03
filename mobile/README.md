# OfirBaby Admin (Android) — dual WebView shell

Practical phone app that opens the two existing OfirBaby admin panels:

| Tab | URL |
|-----|-----|
| תורים | https://www.ofirbaby.com/booking/admin |
| אתר | https://www.ofirbaby.com/admin |

The websites remain the source of truth. Each panel keeps its own login. No Bearer-token backend and no native CMS in this version.

Launcher icon uses the OfirBaby brand logo from `public/ofirbaby-logo.png`.

## Setup / build APK

```bash
cd mobile
npm install
npm run build:apk
```

APK: `android/app/build/outputs/apk/release/app-release.apk`  
Signed with the Android debug keystore for sideload testing (not Play Store).

## WebView behavior

- Cookies + DOM storage (session persistence)
- File / image chooser (system picker)
- Downloads / external links open outside the WebView when not on trusted hosts
- Android Back + in-app “חזרה” for WebView history
- Loading progress + error + retry
- Large Hebrew bottom tabs: **תורים** and **אתר** (safe-area padded so they stay above system navigation)

## What you must test with real credentials on a phone

- Booking admin login (password / Google) and day-to-day appointment actions
- Website admin login, media upload, content edit, publish
- Session still present after force-stop / reopen
- File pickers and any download buttons in either panel
- Both tabs visible and switchable; OfirBaby logo as home-screen launcher icon
