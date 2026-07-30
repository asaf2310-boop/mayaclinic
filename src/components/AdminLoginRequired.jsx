import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/AuthContext";

function GoogleGlyph() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function AdminLoginRequired() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [authOptions, setAuthOptions] = useState({
    googleConfigured: false,
    passwordConfigured: true,
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const { checkAppState } = useAuth();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/admin?action=session");
        const data = await response.json().catch(() => ({}));
        if (!cancelled) {
          setAuthOptions({
            googleConfigured: Boolean(data?.googleConfigured),
            passwordConfigured: data?.passwordConfigured !== false,
          });
        }
      } catch {
        if (!cancelled) {
          setAuthOptions({ googleConfigured: false, passwordConfigured: true });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const adminError = searchParams.get("admin_error");
    if (!adminError) return;
    setError(adminError);
    const next = new URLSearchParams(searchParams);
    next.delete("admin_error");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  async function onSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin?action=login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Login failed");
      }
      await checkAppState();
      window.location.reload();
    } catch (err) {
      setError(err?.message || "סיסמה שגויה");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-20" dir="rtl">
      <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
          <LockKeyhole className="h-8 w-8 text-slate-700" />
        </div>
        <h1 className="mb-3 text-2xl font-bold text-slate-900">כניסה לאזור הניהול</h1>
        <p className="mb-6 text-slate-600">הזינו סיסמת אדמין כדי להיכנס ללוח הניהול.</p>

        {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

        {authOptions.passwordConfigured ? (
          <form onSubmit={onSubmit} className="space-y-4 text-right">
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="סיסמת אדמין"
              autoComplete="current-password"
              dir="ltr"
            />
            <Button className="w-full" disabled={loading || !password.trim()} type="submit">
              {loading ? "בודק..." : "כניסה"}
            </Button>
          </form>
        ) : null}

        {authOptions.googleConfigured ? (
          <div className="mt-6 border-t border-slate-100 pt-6">
            <Button asChild className="w-full gap-2 border border-slate-200 bg-white text-slate-800 hover:bg-slate-50">
              <a href="/api/admin?action=google-start">
                <GoogleGlyph />
                התחברות עם Gmail
              </a>
            </Button>
          </div>
        ) : null}

        <div className="mt-4">
          <Link to="/book" className="text-sm text-slate-500 hover:text-slate-800">
            חזרה לקביעת תור
          </Link>
        </div>
      </div>
    </div>
  );
}
