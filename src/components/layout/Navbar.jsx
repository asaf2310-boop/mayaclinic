import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CalendarPlus, Menu, X, Shield } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const location = useLocation();

  useEffect(() => {
    base44.auth.me().then((user) => {
      if (user?.role === "admin") setIsAdmin(true);
    }).catch(() => {});
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50" dir="rtl">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-foreground">
          הקליניקה
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          <Link to="/" className={`text-sm font-medium transition-colors ${location.pathname === '/' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            עמוד הבית
          </Link>
          <Link to="/book" className={`text-sm font-medium transition-colors ${location.pathname === '/book' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            קביעת תור
          </Link>
          {isAdmin && (
            <Link to="/admin" className={`text-sm font-medium transition-colors flex items-center gap-1.5 ${location.pathname === '/admin' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              <Shield className="w-3.5 h-3.5" />
              ניהול
            </Link>
          )}
          <Link to="/book">
            <Button size="sm" className="rounded-lg gap-1.5">
              <CalendarPlus className="w-4 h-4" />
              הזמינו תור
            </Button>
          </Link>
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl px-6 py-4 space-y-3">
          <Link to="/" onClick={() => setIsOpen(false)} className="block text-sm font-medium text-foreground py-2">עמוד הבית</Link>
          <Link to="/book" onClick={() => setIsOpen(false)} className="block text-sm font-medium text-foreground py-2">קביעת תור</Link>
          {isAdmin && (
            <Link to="/admin" onClick={() => setIsOpen(false)} className="block text-sm font-medium text-foreground py-2">ניהול</Link>
          )}
        </div>
      )}
    </nav>
  );
}