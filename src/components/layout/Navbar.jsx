import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Shield } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { demoModeEnabled } from "@/api/demoClient";
import { getDemoBrand } from "@/lib/demoBrand";
import { getClinicSite } from "@/lib/clinicSite";
import { clinicNavGlass, clinicPrimaryBtn } from "@/lib/clinicUi";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const location = useLocation();
  const demoBrand = getDemoBrand();
  const clinicSite = getClinicSite();

  useEffect(() => {
    base44.auth.me().then((user) => {
      if (user?.role === "admin") setIsAdmin(true);
    }).catch(() => {});
  }, []);

  const isClinic = Boolean(clinicSite);

  const linkClass = (path) =>
    `rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
      location.pathname === path
        ? isClinic
          ? "bg-[#416d5c]/15 text-[#2f5245] shadow-sm"
          : "bg-primary/10 text-primary shadow-sm"
        : isClinic
          ? "text-[#2f5245]/70 hover:bg-white/60 hover:text-[#416d5c]"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 ${
        isClinic
          ? clinicNavGlass
          : "border-b border-border/50 bg-background/80 backdrop-blur-xl"
      }`}
      dir="rtl"
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link
            to="/"
            className={`text-xl font-bold ${isClinic ? "text-[#1e2f27]" : "text-foreground"}`}
          >
            {clinicSite?.clinicTitle || (demoModeEnabled ? demoBrand.clinicTitle : "הקליניקה")}
          </Link>
          {demoModeEnabled && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
              סביבת דמו{demoBrand.isClientAlias ? ` · ${demoBrand.clientLabel}` : ""}
            </span>
          )}

          {/* Desktop nav */}
          <div
            className={`hidden md:flex items-center gap-2 rounded-full p-1 ${
              isClinic ? "bg-white/50 ring-1 ring-white/60" : "bg-muted/40"
            }`}
          >
            <Link to="/" className={linkClass("/")}>
              עמוד הבית
            </Link>
            <Link
              to="/book"
              className={
                location.pathname === "/book"
                  ? linkClass("/book")
                  : isClinic
                    ? `${clinicPrimaryBtn} !px-5 !py-2 text-sm`
                    : linkClass("/book")
              }
            >
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
        <button
          className={`md:hidden rounded-full p-2 ${
            isClinic ? "bg-white/50 text-[#2f5245]" : "bg-muted/60"
          }`}
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div
          className={`md:hidden border-t backdrop-blur-xl px-6 py-4 space-y-2 text-right ${
            isClinic
              ? "border-white/60 bg-white/90"
              : "border-border/50 bg-background/95"
          }`}
        >
          <Link
            to="/"
            onClick={() => setIsOpen(false)}
            className={`block rounded-xl px-4 py-3 text-sm font-semibold ${
              isClinic ? "text-[#1e2f27] hover:bg-white/60" : "text-foreground hover:bg-muted"
            }`}
          >
            עמוד הבית
          </Link>
          <Link
            to="/book"
            onClick={() => setIsOpen(false)}
            className={`block rounded-xl px-4 py-3 text-sm font-semibold ${
              isClinic
                ? `${clinicPrimaryBtn} text-center`
                : "text-foreground hover:bg-muted"
            }`}
          >
            קביעת תור
          </Link>
          {isAdmin && (
            <Link to="/admin" onClick={() => setIsOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted">ניהול</Link>
          )}
        </div>
      )}
    </nav>
  );
}