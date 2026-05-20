import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Shield } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { demoModeEnabled } from "@/api/demoClient";
import { getDemoBrand } from "@/lib/demoBrand";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const location = useLocation();
  const demoBrand = getDemoBrand();

  useEffect(() => {
    base44.auth.me().then((user) => {
      if (user?.role === "admin") setIsAdmin(true);
    }).catch(() => {});
  }, []);

  const linkClass = (path) =>
    `rounded-full px-4 py-2 text-sm font-semibold transition-all ${
      location.pathname === path
        ? "bg-primary/10 text-primary shadow-sm"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50" dir="rtl">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="text-xl font-bold text-foreground">
            {demoModeEnabled ? demoBrand.clinicTitle : "הקליניקה"}
          </Link>
          {demoModeEnabled && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
              סביבת דמו{demoBrand.isClientAlias ? ` · ${demoBrand.clientLabel}` : ""}
            </span>
          )}

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-2 rounded-full bg-muted/40 p-1">
            <Link to="/" className={linkClass("/")}>
              עמוד הבית
            </Link>
            <Link to="/book" className={linkClass("/book")}>
              קביעת תור
            </Link>
            {isAdmin && (
              <Link to="/admin" className={`${linkClass("/admin")} inline-flex items-center gap-1.5`}>
                <Shield className="w-3.5 h-3.5" />
                ניהול
              </Link>
            )}
          </div>
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden rounded-full bg-muted/60 p-2" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl px-6 py-4 space-y-2 text-right">
          <Link to="/" onClick={() => setIsOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted">עמוד הבית</Link>
          <Link to="/book" onClick={() => setIsOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted">קביעת תור</Link>
          {isAdmin && (
            <Link to="/admin" onClick={() => setIsOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted">ניהול</Link>
          )}
        </div>
      )}
    </nav>
  );
}