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
