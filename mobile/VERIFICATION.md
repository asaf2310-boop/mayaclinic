# Dual WebView admin shell — verification

## Emulator results (no credentials)

| Check | Result |
|-------|--------|
| App launches without crash | PASS |
| תורים tab loads `https://www.ofirbaby.com/booking/admin` login | PASS |
| אתר tab loads `https://www.ofirbaby.com/admin` login | PASS |
| Switch tabs both ways | PASS |
| Refresh button reloads current WebView | PASS |
| Hebrew RTL bottom navigation | PASS |

Evidence: `wv_appointments_tab.png`, `wv_website_tab.png`

## Requires your testing with real admin credentials (physical phone)

- Booking admin password / Google login and session persistence after app kill
- Website admin email/password login and session persistence
- Media / image upload (file chooser) on Website tab
- Content edit + publish on Website
- Appointment day-to-day actions inside booking admin WebView
- Any download buttons (e.g. reports)
- Android Back within nested admin pages

## Backend

Bearer-token `/api/admin` changes were **reverted** from this branch. No production deploy required for this APK.
