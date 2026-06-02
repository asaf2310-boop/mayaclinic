import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { demoModeEnabled } from "@/api/demoClient";
import { getClinicSite } from "@/lib/clinicSite";
import { BarChart3, CalendarCheck, CheckCircle2, ExternalLink, Megaphone, MonitorSmartphone, Users } from "lucide-react";

const DEFAULT_DEMO_URL = "https://karinshinanit-demo.vercel.app";

function getDemoUrls() {
  if (demoModeEnabled && typeof window !== "undefined") {
    const base = window.location.origin;
    return {
      booking: `${base}/book`,
      admin: `${base}/admin`,
    };
  }

  const base = (import.meta.env.VITE_DEMO_URL || DEFAULT_DEMO_URL).replace(/\/$/, "");
  return {
    booking: `${base}/book`,
    admin: `${base}/admin`,
  };
}

const features = [
  {
    title: "קביעת תורים אונליין",
    description: "לקוחות בוחרים טיפול, יום ושעה פנויה מתוך זמינות שהוגדרה מראש.",
    icon: CalendarCheck,
  },
  {
    title: "חסימת תורים חכמים",
    description: "המערכת מונעת הזמנות צפופות מדי ושומרת על מרווחי זמן בין תורים.",
    icon: CheckCircle2,
  },
  {
    title: "ניהול לקוחות",
    description: "כל לקוח מקבל כרטיס עם פרטים אישיים, היסטוריית טיפולים ואפשרות לדיוור.",
    icon: Users,
  },
  {
    title: "דוחות הכנסות",
    description: "דוח חודשי לפי סוג טיפול, כולל סינון ויצוא לאקסל.",
    icon: BarChart3,
  },
];

const adminHighlights = [
  "ניהול זמינות לפי ימים ושעות",
  "עריכה ומחיקה של תורים",
  "סטטוס תור ותשלום",
  "כרטיסי לקוחות אוטומטיים",
  "דיוור שיווקי בוואטסאפ או אימייל",
  "סביבת דמו נפרדת ללא דאטה אמיתי",
];

export default function Home() {
  const clinicSite = getClinicSite();
  const [heroImageMissing, setHeroImageMissing] = useState(false);
  const { booking: demoBookingUrl, admin: demoAdminUrl } = useMemo(() => getDemoUrls(), []);

  if (clinicSite) {
    return (
      <div className="min-h-screen font-sans">
        <Navbar />
        <main>
          <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#fafffe] via-[#f0faf5] to-[#e4f4ec] pt-16">
            <div className="pointer-events-none absolute -left-24 top-0 h-[520px] w-[520px] rounded-full bg-teal-200/40 blur-[100px]" />
            <div className="pointer-events-none absolute -right-32 top-1/4 h-[480px] w-[480px] rounded-full bg-emerald-100/60 blur-[110px]" />
            <div className="pointer-events-none absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-cyan-100/50 blur-[90px]" />

            <div className="container relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] grid-cols-1 items-center gap-10 px-4 py-16 lg:grid-cols-2 lg:gap-16 lg:px-8">
              <div className="order-2 flex flex-col justify-center space-y-10 text-right lg:order-1" dir="rtl">
                <div className="inline-flex items-center gap-2.5 self-start rounded-full border border-white/80 bg-white/70 px-5 py-2 shadow-sm shadow-emerald-900/5 backdrop-blur-xl">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                  <span className="text-xs font-semibold tracking-wide text-emerald-800">{clinicSite.heroBadge}</span>
                </div>

                <div className="space-y-6">
                  <h1 className="text-4xl font-extrabold leading-[1.15] tracking-tight text-[#1a2e28] md:text-5xl lg:text-[3.5rem]">
                    {clinicSite.heroHeading}{" "}
                    <br className="hidden md:inline" />
                    {clinicSite.heroHeadingMid}{" "}
                    <span className="bg-gradient-to-l from-emerald-600 via-teal-600 to-emerald-500 bg-clip-text text-transparent">
                      {clinicSite.heroHeadingHighlight}
                    </span>
                  </h1>

                  <p className="max-w-xl text-base font-normal leading-relaxed text-[#4a6b5f] md:text-lg md:leading-8">
                    {clinicSite.heroSubtext}
                  </p>
                </div>

                <div className="pt-2">
                  <Link
                    to="/book"
                    className="group inline-flex items-center justify-center rounded-full bg-gradient-to-l from-emerald-500 to-teal-600 px-10 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all duration-300 hover:scale-[1.03] hover:shadow-xl hover:shadow-emerald-500/40 active:scale-[0.98]"
                  >
                    {clinicSite.heroCtaPrimary}
                  </Link>
                </div>
              </div>

              <div className="relative order-1 flex h-[400px] w-full items-center justify-center md:h-[500px] lg:order-2 lg:h-[600px]">
                <div className="relative h-full w-full overflow-hidden rounded-[2.5rem] border border-white/70 bg-white/30 shadow-2xl shadow-emerald-900/10 ring-1 ring-white/50 backdrop-blur-sm">
                  {!heroImageMissing ? (
                    <img
                      src={clinicSite.heroImage}
                      alt={clinicSite.clinicTitle}
                      className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.03]"
                      loading="eager"
                      decoding="async"
                      onError={() => setHeroImageMissing(true)}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-white/60 px-6 text-center text-[#4a6b5f]">
                      לא נטענה תמונת הקליניקה
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-emerald-950/15 via-transparent to-white/10" />
                </div>

                <div
                  className="absolute top-1/2 -left-4 hidden max-w-[170px] -translate-y-1/2 rounded-2xl border border-white/80 bg-white/75 p-5 text-center shadow-xl shadow-emerald-900/10 backdrop-blur-2xl transition-transform duration-300 hover:-translate-y-[calc(50%+4px)] sm:block"
                  dir="rtl"
                >
                  <div className="mx-auto mb-2.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 text-xl shadow-inner">
                    🌱
                  </div>
                  <h4 className="text-xs font-bold text-[#1a2e28]">{clinicSite.heroFloatingTitle}</h4>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#4a6b5f]">{clinicSite.heroFloatingSubtitle}</p>
                </div>

                <div
                  className="absolute bottom-6 right-6 flex items-center gap-3 rounded-2xl border border-white/80 bg-white/80 px-5 py-3.5 shadow-lg shadow-emerald-900/10 backdrop-blur-2xl"
                  dir="ltr"
                >
                  <div className="relative flex h-2.5 w-2.5 items-center justify-center">
                    <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-emerald-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  </div>
                  <div className="text-right" dir="rtl">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-emerald-700/70">
                      {clinicSite.heroLiveStatusLabel}
                    </span>
                    <span className="text-xs font-bold text-[#1a2e28]">{clinicSite.heroLiveStatusText}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-16" dir="rtl">
        <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-muted/40 px-6 py-20">
          <div className="absolute left-10 top-24 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute bottom-10 right-10 h-52 w-52 rounded-full bg-emerald-300/20 blur-3xl" />

          <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-7">
              <Badge className="w-fit rounded-full px-4 py-1.5 text-sm">מערכת דיגיטלית לקליניקות</Badge>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-black leading-tight text-foreground md:text-6xl">
                  מערכת קביעת תורים וניהול לקוחות לקליניקה שלך
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
                  אתר הזמנות, ממשק אדמין, ניהול זמינות, כרטיסי לקוחות ודוחות הכנסות במקום אחד. מתאים לקליניקות שרוצות להציג תהליך מקצועי ללקוחות ולנהל את העסק בלי קבצים ידניים.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <a href={demoBookingUrl} target="_blank" rel="noreferrer">
                  <Button size="lg" className="h-12 rounded-xl px-6 text-base">
                    דמו הזמנת תורים
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
                <a href={demoAdminUrl} target="_blank" rel="noreferrer">
                  <Button size="lg" variant="outline" className="h-12 rounded-xl px-6 text-base">
                    דמו מערכת ניהול
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>

            <Card className="relative overflow-hidden rounded-3xl border-border/60 bg-card/90 p-5 shadow-2xl">
              <div className="rounded-2xl bg-muted/50 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">תצוגת אדמין</p>
                    <h2 className="text-2xl font-bold">ניהול הקליניקה</h2>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                    <MonitorSmartphone className="h-6 w-6" />
                  </div>
                </div>

                <div className="grid gap-3">
                  {adminHighlights.slice(0, 4).map((highlight) => (
                    <div key={highlight} className="flex items-center gap-3 rounded-xl bg-background p-3 shadow-sm">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="font-medium">{highlight}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </section>

        <section className="px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold md:text-4xl">מה המערכת כוללת?</h2>
              <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
                כל מה שצריך כדי להציג ללקוח חוויית הזמנה מסודרת ולנהל את הפעילות היומית מאחורי הקלעים.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <Card key={feature.title} className="p-6 transition-all hover:-translate-y-1 hover:shadow-lg">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 text-xl font-bold">{feature.title}</h3>
                  <p className="leading-7 text-muted-foreground">{feature.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-muted/30 px-6 py-20">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2">
            <Card className="p-8">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <Megaphone className="h-6 w-6" />
              </div>
              <h2 className="mb-4 text-3xl font-bold">מתאים להצגה ללקוחות חדשים</h2>
              <p className="mb-6 leading-8 text-muted-foreground">
                סביבת הדמו כוללת לקוחות פיקטיביים, תורים, הכנסות ודוחות, כך שאפשר להציג את המערכת בלי לחשוף מידע אמיתי.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <a href={demoBookingUrl} target="_blank" rel="noreferrer">
                  <Button className="rounded-xl">
                    דמו הזמנת תורים
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
                <a href={demoAdminUrl} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="rounded-xl">
                    דמו מערכת ניהול
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            </Card>

            <Card className="p-8">
              <h2 className="mb-5 text-3xl font-bold">יכולות מרכזיות באדמין</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {adminHighlights.map((highlight) => (
                  <div key={highlight} className="rounded-xl border border-border/60 bg-background p-4 font-medium">
                    {highlight}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-10 px-6 text-center" dir="rtl">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} הקליניקה. כל הזכויות שמורות.
        </p>
      </footer>
    </div>
  );
}