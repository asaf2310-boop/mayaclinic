import {
  clearAdminSessionCookie,
  setAdminSessionCookie,
} from "../server/adminSession.js";
import {
  exchangeGoogleCode,
  getPublicOrigin,
  isAllowedAdminEmail,
  verifyOAuthState,
} from "../server/googleAdminAuth.js";

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.end();
}

export default async function handler(req, res) {
  const origin = getPublicOrigin(req);

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const errorParam = String(req.query?.error || "").trim();
  if (errorParam) {
    clearAdminSessionCookie(res);
    redirect(res, `${origin}/admin?admin_error=${encodeURIComponent("ההתחברות עם Google בוטלה")}`);
    return;
  }

  const code = String(req.query?.code || "").trim();
  const state = String(req.query?.state || "").trim();

  if (!code || !verifyOAuthState(state)) {
    clearAdminSessionCookie(res);
    redirect(res, `${origin}/admin?admin_error=${encodeURIComponent("בקשת התחברות לא תקינה")}`);
    return;
  }

  try {
    const profile = await exchangeGoogleCode(req, code);
    if (!profile.emailVerified) {
      clearAdminSessionCookie(res);
      redirect(
        res,
        `${origin}/admin?admin_error=${encodeURIComponent("יש לאמת את כתובת ה-Gmail לפני כניסה")}`
      );
      return;
    }

    if (!isAllowedAdminEmail(profile.email)) {
      clearAdminSessionCookie(res);
      redirect(
        res,
        `${origin}/admin?admin_error=${encodeURIComponent("החשבון לא מורשה לניהול הקליניקה")}`
      );
      return;
    }

    setAdminSessionCookie(res, { email: profile.email, method: "google" });
    redirect(res, `${origin}/admin`);
  } catch (error) {
    clearAdminSessionCookie(res);
    redirect(
      res,
      `${origin}/admin?admin_error=${encodeURIComponent(error?.message || "התחברות Google נכשלה")}`
    );
  }
}
