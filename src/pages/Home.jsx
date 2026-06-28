import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { demoModeEnabled } from "@/api/demoClient";
import { getClinicSite } from "@/lib/clinicSite";
import {
  clinicFadeIn,
  clinicHeroEyebrow,
  clinicHeroImageFrame,
  clinicHeroPanel,
  clinicHeroSection,
  clinicHeroTitle,
  clinicHeroTitleBlock,
  clinicHeroTitleDecor,
  clinicHeroTitleGradient,
  clinicHeroTitleRuleDot,
  clinicHeroTitleRuleLeft,
  clinicHeroTitleRuleRight,
  clinicPageGradient,
  clinicHeroCtaBtn,
  clinicHeroCtaIcon,
  clinicHeroPremiumCard,
  clinicHeroPremiumIconRing,
  clinicHeroPremiumLabel,
  clinicTextMuted,
} from "@/lib/clinicUi";
import HeroMeridianButton from "../components/home/HeroMeridianButton";
import { BarChart3, CalendarCheck, CheckCircle2, ExternalLink, Flower2, Home as HomeIcon, Leaf, Megaphone, MonitorSmartphone, Users } from "lucide-react";

function HeroPremiumIcon({ icon }) {
  if (icon === "lotus") {
    return <Flower2 className="h-7 w-7 text-[#5D7F6D] md:h-10 md:w-10" strokeWidth={1.4} aria-hidden="true" />;
  }

  return (
    <span className="relative flex h-7 w-7 items-center justify-center md:h-10 md:w-10" aria-hidden="true">
      <HomeIcon className="h-6 w-6 text-[#5D7F6D] md:h-9 md:w-9" strokeWidth={1.4} />
      <Leaf className="absolute -bottom-0.5 -left-0.5 h-3 w-3 text-[#7F9B8A] md:h-[18px] md:w-[18px]" strokeWidth={1.6} />
    </span>
  );
}

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
      <div className={`page-background min-h-screen font-sans ${clinicPageGradient} clinic-page-enter`}>
        <Navbar />
        <main>
          <section className={clinicHeroSection}>
            <div
              className="clinic-hero-shell relative z-10 mx-auto flex min-h-0 max-w-4xl flex-col items-center justify-center px-4 py-5 md:min-h-[calc(100vh-6rem)] md:px-6 md:py-12"
              dir="rtl"
            >
              <div className={`${clinicHeroPanel} ${clinicFadeIn} flex flex-col items-center text-center`}>
                <div className={clinicHeroTitleBlock} dir="rtl">
                  <span className={clinicHeroEyebrow}>ABOUT THE CLINIC</span>
                  <h2 className={clinicHeroTitle}>
                    <span className={clinicHeroTitleGradient}>{clinicSite.clinicTitle}</span>
                  </h2>
                  <div className={clinicHeroTitleDecor} aria-hidden="true">
                    <div className={clinicHeroTitleRuleLeft} />
                    <div className={clinicHeroTitleRuleDot} />
                    <div className={clinicHeroTitleRuleRight} />
                  </div>
                </div>

                <div className="mb-4 w-full max-w-sm md:mb-8 md:max-w-md">
                  <div className={`${clinicHeroImageFrame} h-auto transition-transform duration-300 hover:scale-[1.01]`}>
                    {!heroImageMissing ? (
                      <img
                        src={clinicSite.heroImage}
                        alt={clinicSite.clinicTitle}
                        className="h-[220px] w-full object-cover md:h-auto md:max-h-[440px] md:object-contain"
                        loading="eager"
                        decoding="async"
                        onError={() => setHeroImageMissing(true)}
                      />
                    ) : (
                      <div className={`flex min-h-[240px] items-center justify-center bg-white px-6 py-12 ${clinicTextMuted}`}>
                        לא נטענה תמונת הקליניקה
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex w-full flex-col items-stretch gap-3.5 pt-0 md:gap-7 md:pt-2">
                  <Link to="/book" className={clinicHeroCtaBtn}>
                    <Leaf className={clinicHeroCtaIcon} strokeWidth={1.5} aria-hidden="true" />
                    {clinicSite.heroCtaPrimary}
                  </Link>
                  {clinicSite.heroExternalLinks?.length > 0 && (
                    <div className="grid grid-cols-2 gap-2.5 sm:gap-5">
                      {clinicSite.heroExternalLinks.map((link) => (
                        <a
                          key={link.url}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={clinicHeroPremiumCard}
                        >
                          <div className={clinicHeroPremiumIconRing}>
                            <HeroPremiumIcon icon={link.icon} />
                          </div>
                          <span className={clinicHeroPremiumLabel}>{link.label}</span>
                        </a>
                      ))}
                    </div>
                  )}
                  {clinicSite.heroMeridianLink && (
                    <div className="flex w-full justify-center pt-0 md:pt-1">
                      <HeroMeridianButton link={clinicSite.heroMeridianLink} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-tr from-[#f3f7f4] via-[#edf3ee] to-[#e6ece7]">
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
