import React, { useState } from "react";
import { Link } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/AuthContext";

export default function AdminLoginRequired() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { checkAppState } = useAuth();

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
        <p className="mb-6 text-slate-600">הזן סיסמת אדמין משותפת כדי להיכנס ללוח הניהול.</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="סיסמת אדמין"
            autoComplete="current-password"
            dir="ltr"
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button className="w-full" disabled={loading || !password.trim()} type="submit">
            {loading ? "בודק..." : "כניסה"}
          </Button>
        </form>

        <div className="mt-4">
          <Link to="/book" className="text-sm text-slate-500 hover:text-slate-800">
            חזרה לקביעת תור
          </Link>
        </div>
      </div>
    </div>
  );
}
