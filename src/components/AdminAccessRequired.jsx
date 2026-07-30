import React from "react";
import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminAccessRequired() {
  return (
    <div className="min-h-screen bg-slate-50 px-6 py-20" dir="rtl">
      <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50">
          <ShieldAlert className="h-8 w-8 text-amber-600" />
        </div>
        <h1 className="mb-3 text-2xl font-bold text-slate-900">גישה לאזור ניהול חסומה כרגע</h1>
        <p className="mb-6 text-slate-600">
          זיהינו חולשת אבטחה במסלול הניהול במצב Supabase. עד שנחבר אימות שרת אמיתי,
          עמודי האדמין הושבתו כדי להגן על נתוני המטופלים.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/">
            <Button>חזרה לעמוד הבית</Button>
          </Link>
          <Link to="/book">
            <Button variant="outline">מעבר לקביעת תור</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
