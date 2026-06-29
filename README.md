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

ב-Supabase SQL Editor, ודאו שרצו לפחות:

1. `supabase/schema.sql`
2. `supabase/multi-tenant.sql` (כולל `paybox_link` ו-`tenant_id`)
3. `supabase/treatments-paybox.sql` — רק אם ה-DB נוצר לפני שהעמודה נוספה ל-schema

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
