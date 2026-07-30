**Maya Clinic**

**About**

מערכת לקביעת תורים, ניהול זמינות, ניהול לקוחות ודוחות הכנסות לקליניקה.

This project contains everything you need to run your app locally.

## Backend modes

המערכת תומכת בשתי סביבות:

- `Supabase` לפרודקשן עם דאטה אמיתי.
- `VITE_DEMO_MODE=true` לסביבת דמו עם נתונים פיקטיביים ב־localStorage, בלי חיבור ל־Supabase.

**Edit the code in your local development environment**

Any change pushed to the repo will also be reflected in the Base44 Builder.

**Prerequisites:** 

1. Clone the repository using the project's Git URL 
2. Navigate to the project directory
3. Install dependencies: `npm install`
4. Create an `.env.local` file and set the right environment variables

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

For a local demo environment:

```env
VITE_DEMO_MODE=true
```

Run the app: `npm run dev`

## Maya / ofirbaby production (Vercel)

פרויקטים כמו `ofirbaby.vercel.app` ו-`maya-clinic.vercel.app` חייבים Supabase בפרויקט Vercel (Settings → Environment Variables):

```env
VITE_SUPABASE_URL=https://furrjspvtmyvjikynkfj.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key from Supabase Dashboard → API>
```

אופציונלי (ברירת מחדל מהדומיין — `maya`):

```env
VITE_CLINIC_TENANT_ID=maya
```

אחרי הוספת משתנים: **Redeploy** (Build לא קורא env חדש בלי פריסה מחדש).

## כניסת אדמין עם Gmail (Google OAuth)

`/admin` מוגן. ההתחברות המומלצת היא עם חשבון Gmail מורשה (אתם / מאיה).

ב־Google Cloud Console צרו **OAuth 2.0 Client ID** (Web application) והוסיפו:

**Authorized redirect URI:**

```text
https://ofirbaby.vercel.app/api/admin-google-callback
```

ב־Vercel הגדירו:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
ADMIN_EMAILS=ofirbabyinfo@gmail.com,asaf2310@gmail.com,maya@gmail.com
ADMIN_SESSION_SECRET=long_random_secret
PUBLIC_ORIGIN=https://ofirbaby.vercel.app
```

רק המיילים ב־`ADMIN_EMAILS` יוכלו להיכנס. סיסמה משותפת (`ADMIN_ACCESS_PASSWORD`) היא גיבוי אופציונלי בלבד.

## סליקת אשראי — Pelecard (ManualIframe)

בשלב התשלום בקביעת תור מוצג iframe של Pelecard (`PaymentGW/init` לפי [מדריך ManualIframe](https://gateway20.pelecard.biz/ManualIframe)).

ב־Vercel (או `.env.local` מקומי ל־API) הגדירו:

```env
PELECARD_TERMINAL=...
PELECARD_USER=...
PELECARD_PASSWORD=...
```

אופציונלי:

```env
PELECARD_GATEWAY_BASE=https://gateway20.pelecard.biz
PELECARD_MAX_PAYMENTS=1
PELECARD_MIN_PAYMENTS=1
PELECARD_CSS_CDN=https://ofirbaby.vercel.app/payment/clinic-v4.css
PELECARD_PUBLIC_ORIGIN=https://ofirbaby.vercel.app
PELECARD_TOP_TEXT=אופיר - מרכז טיפול הוליסטי
```

עיצוב ה־iframe משתמש ב־`CssURL` המותאם של הקליניקה (`https://ofirbaby.vercel.app/payment/clinic-v4.css`) — הכתובת ב־whitelist אצל Pelecard. הכפתור ירוק־מרווה `#5D7F6D` ורקע טיפולי רך. **חובה להתחיל תשלום חדש** אחרי עדכון עיצוב.

### משוב לצד שרת + דפי הצלחה/כישלון

ב־`PaymentGW/init` מוגדרים:
- `ServerSideGoodFeedbackURL` / `ServerSideErrorFeedbackURL` → `/api/pelecard/feedback`
- `FeedbackOnTop=True` + `GoodURL`/`ErrorURL` → `/api/pelecard/return` שמעביר ל־`/payment/success` או `/payment/failure`

ב־Supabase SQL Editor הריצו גם:

```text
supabase/pelecard-payments.sql
```

אחרי תשלום מוצלח השרת מאמת עם `ValidateByUniqueKey`, יוצר תורים עם `paid=true`, והלקוח מגיע לדף ההצלחה.
בלי פרטי Pelecard נשארים Bit / PayBox כמו קודם.

ב-Supabase SQL Editor, ודאו שרצו לפחות:

1. `supabase/schema.sql`
2. `supabase/multi-tenant.sql` (הגרסה המעודכנת בלבד — סוגרת גישה ישירה מהדפדפן לטבלאות tenant)
3. `supabase/treatments-paybox.sql` — רק אם ה-DB נוצר לפני שהעמודה נוספה ל-schema
4. `supabase/pelecard-payments.sql` — לסליקת Pelecard (משוב שרת + דפי הצלחה/כישלון, ללא anon select)

> אם הרצתם בעבר גרסה ישנה של `multi-tenant.sql` / `pelecard-payments.sql`, הריצו שוב את הקבצים המעודכנים כדי להחליף policies פתוחים.

## Demo deployment

הדמו לא צריך GitHub repo נפרד. משתמשים באותו repo של `mayaclinic`, ויוצרים ממנו Project נוסף ב־Vercel.

For the separate Vercel demo project, set only:

```env
VITE_DEMO_MODE=true
```

Do not set `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` in the demo project.

Upload code changes to the regular GitHub repo:

```powershell
powershell -ExecutionPolicy Bypass -File .\upload-mayaclinic-to-github.ps1
```

## Demo: כמה דומיינים עם כותרת שונה בוואטסאפ

1. ב־Vercel → **אותו פרויקט דמו** → `Domains` → הוסף `michal-demo.vercel.app` (אליאס).
2. בקובץ `demo-clients.json` הוסף את שם הלקוח באנגלית (למשל `"michal"`).
3. העלה קוד + `Redeploy`.

דוגמה `demo-clients.json`:

```json
{
  "spaHomeHosts": ["karinshinanit-demo.vercel.app"],
  "clients": ["michal", "yael"]
}
```

- `karinshinanit-demo.vercel.app` = דף נחיתה רגיל (קארין).
- `michal-demo.vercel.app` = בוואטסאפ יופיע **הקליניקה של מיכל**, ואז מעבר לדמו הראשי (קובץ סטטי `landing-michal.html`).

אחרי פריסה, בדיקה מהירה: `https://michal-demo.vercel.app/landing-michal.html` — אם רואים "מיכל" בכותרת, זה עובד.

אופציונלי ב־Vercel:

```env
DEMO_PRIMARY_ORIGIN=https://karinshinanit-demo.vercel.app
```

**חשוב:** אם `michal-demo` מחובר לפרויקט Vercel **אחר** או בלי העלאת קוד חדש — תמיד תראה קארין.
