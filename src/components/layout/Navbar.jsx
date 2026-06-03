import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Shield } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { demoModeEnabled } from "@/api/demoClient";
import { getDemoBrand } from "@/lib/demoBrand";
import { getClinicSite } from "@/lib/clinicSite";
import {
  clinicNavGlass,
  clinicNavLink,
  clinicNavLinkActive,
  clinicNavShell,
  clinicPrimaryBtn,
  clinicTextHeading,
} from "@/lib/clinicUi";

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
    location.pathname === path ? clinicNavLinkActive : clinicNavLink;

  const navContent = (
  <>
        <Link
          to="/"
          className={`shrink-0 text-lg font-bold md:text-xl ${isClinic ? clinicTextHeading : "text-foreground"}`}
        >
          {clinicSite?.clinicTitle || (demoModeEnabled ? demoBrand.clinicTitle : "הקליניקה")}
        </Link>
        {demoModeEnabled && (
          <span className="hidden rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 sm:inline">
            סביבת דמו{demoBrand.isClientAlias ? ` · ${demoBrand.clientLabel}` : ""}
          </span>
        )}

        <div className="hidden items-center gap-1 md:flex">
          <Link to="/" className={linkClass("/")}>
            עמוד הבית
          </Link>
          <Link
            to="/book"
            className={
              location.pathname === "/book"
                ? linkClass("/book")
                : isClinic
                  ? `${clinicPrimaryBtn} !h-10 !px-5 !py-2 text-sm`
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

        <button
          className={`rounded-full p-2 md:hidden ${
            isClinic ? "text-[#5D7F6D] hover:bg-[#F7F8F6]" : "bg-muted/60"
          }`}
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "סגור תפריט" : "פתח תפריט"}
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
  </>
  );

  if (isClinic) {
    return (
      <>
        <div className={clinicNavShell} dir="rtl">
          <nav className={clinicNavGlass}>{navContent}</nav>
        </div>

        {isOpen && (
          <div
            className="fixed inset-x-4 top-[4.5rem] z-50 rounded-2xl border border-[#E8ECE8] bg-white p-4 shadow-[0_12px_40px_rgba(0,0,0,0.08)] backdrop-blur-xl md:hidden"
            dir="rtl"
          >
            <div className="space-y-2 text-right">
              <Link
                to="/"
                onClick={() => setIsOpen(false)}
                className={`block rounded-xl px-4 py-3 text-sm font-semibold ${clinicTextHeading} hover:bg-[#F7F8F6]`}
              >
                עמוד הבית
              </Link>
              <Link
                to="/book"
                onClick={() => setIsOpen(false)}
                className={`block rounded-xl px-4 py-3 text-sm font-semibold ${clinicTextHeading} hover:bg-[#F7F8F6]`}
              >
                קביעת תור
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setIsOpen(false)}
                  className={`block rounded-xl px-4 py-3 text-sm font-semibold ${clinicTextHeading} hover:bg-[#F7F8F6]`}
                >
                  ניהול
                </Link>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl"
      dir="rtl"
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        {navContent}
      </div>

      {isOpen && (
        <div className="border-t border-border/50 bg-background/95 px-6 py-4 backdrop-blur-xl md:hidden">
          <div className="space-y-2 text-right">
            <Link
              to="/"
              onClick={() => setIsOpen(false)}
              className="block rounded-xl px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted"
            >
              עמוד הבית
            </Link>
            <Link
              to="/book"
              onClick={() => setIsOpen(false)}
              className="block rounded-xl px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted"
            >
              קביעת תור
            </Link>
            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setIsOpen(false)}
                className="block rounded-xl px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted"
              >
                ניהול
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
