# Dual WebView admin shell — verification

## Android build checks (v1.0.1)

| Check | Result |
|-------|--------|
| App launches without crash | PASS |
| Bottom tab bar shows **תורים** and **אתר** above system nav | PASS |
| תורים loads `https://www.ofirbaby.com/booking/admin` login | PASS |
| אתר loads `https://www.ofirbaby.com/admin` login | PASS |
| Switch tabs both ways | PASS |
| Launcher icon is OfirBaby logo (`public/ofirbaby-logo.png`) | PASS |

Evidence artifacts: `v101_appointments_loaded.png`, `v101_website_tab.png`, `v101_appointments_after_switch.png`, `v101_home_launcher.png`, `v101_launcher_icon_crop.png`

Updated APK: `OfirBaby_Admin_WebView_v1.0.1.apk`  
Release: https://github.com/asaf2310-boop/mayaclinic/releases/download/ofirbaby-admin-webview-v1.0.1/OfirBaby_Admin_WebView_v1.0.1.apk

## Requires your testing with real admin credentials (physical phone)

- Booking admin password / Google login and session persistence after app kill
- Website admin email/password login and session persistence
- Media / image upload (file chooser) on Website tab
- Content edit + publish on Website
- Appointment day-to-day actions inside booking admin WebView
- Any download buttons (e.g. reports)
- Android Back within nested admin pages
- Confirm both tabs and OfirBaby launcher icon on the home screen after install of **v1.0.1** (not the older v1 APK)

## Backend

Bearer-token `/api/admin` changes were **reverted** from this branch. No production deploy required for this APK.
