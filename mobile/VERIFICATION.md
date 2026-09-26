# Dual WebView admin shell — verification

## Android build checks (v1.0.1)

| Check | Result |
|-------|--------|
| App launches without crash | pending rebuild |
| Bottom tab bar shows **תורים** and **אתר** above system nav | pending rebuild |
| תורים loads `https://www.ofirbaby.com/booking/admin` | pending rebuild |
| אתר loads `https://www.ofirbaby.com/admin` | pending rebuild |
| Switch tabs both ways | pending rebuild |
| Launcher icon is OfirBaby logo (`public/ofirbaby-logo.png`) | pending rebuild |

## Requires your testing with real admin credentials (physical phone)

- Booking admin password / Google login and session persistence after app kill
- Website admin email/password login and session persistence
- Media / image upload (file chooser) on Website tab
- Content edit + publish on Website
- Appointment day-to-day actions inside booking admin WebView
- Any download buttons (e.g. reports)
- Android Back within nested admin pages
- Confirm both tabs and OfirBaby launcher icon on the home screen after install

## Backend

Bearer-token `/api/admin` changes were **reverted** from this branch. No production deploy required for this APK.
