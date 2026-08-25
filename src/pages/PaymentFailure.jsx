import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "../components/layout/Navbar";
import {
  fetchPelecardSession,
  getStoredPelecardSessionToken,
} from "@/lib/pelecard";
import { getClinicSite } from "@/lib/clinicSite";
import {
  clinicFadeIn,
  clinicGlassPanel,
  clinicOutlineBtn,
  clinicPageGradient,
  clinicPrimaryBtn,
  clinicTextHeading,
  clinicTextMuted,
} from "@/lib/clinicUi";

export default function PaymentFailure() {
  const [params] = useSearchParams();
  const bookingRef = String(params.get("ref") || "").trim();
  const sessionTokenFromUrl = String(params.get("token") || "").trim();
  const code = String(params.get("code") || "").trim();
  const clinicSite = getClinicSite();
  const [message, setMessage] = useState("");

  useEffect(() => {
    const sessionToken =
      sessionTokenFromUrl || getStoredPelecardSessionToken(bookingRef);
    if (!bookingRef || !sessionToken) return;
    let cancelled = false;
    (async () => {
      try {
        const session = await fetchPelecardSession(bookingRef, sessionToken);
        if (cancelled) return;
        if (session?.errorMessage) setMessage(session.errorMessage);
      } catch {
        // ignore — page still useful without details
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingRef, sessionTokenFromUrl]);

  return (
    <div
      className={`min-h-screen ${clinicSite ? `page-background ${clinicPageGradient} clinic-page-enter font-sans` : "bg-background"}`}
    >
      <Navbar />
      <main className="relative px-6 pb-16 pt-24" dir="rtl">
        <div className={`relative mx-auto max-w-2xl ${clinicSite ? clinicFadeIn : ""}`}>
          <div className={`px-6 py-16 text-center ${clinicSite ? clinicGlassPanel : ""}`}>
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-[#FCE8E8]">
              <AlertCircle className="h-10 w-10 text-[#9B2C2C]" />
            </div>
            <h2 className={`mb-3 text-3xl font-bold ${clinicSite ? clinicTextHeading : "text-foreground"}`}>
              התשלום לא הושלם
            </h2>
            <p className={`mb-2 text-lg ${clinicSite ? clinicTextMuted : "text-muted-foreground"}`}>
              העסקה בוטלה או נכשלה. לא חויבתם — אפשר לנסות שוב.
            </p>
            {(message || code) && (
              <p className={`mb-8 text-sm ${clinicSite ? clinicTextMuted : "text-muted-foreground"}`}>
                {message || `קוד סטטוס: ${code}`}
              </p>
            )}
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/book">
                <Button className={clinicSite ? clinicPrimaryBtn : "rounded-xl"}>
                  ניסיון תשלום מחדש
                </Button>
              </Link>
              <Link to="/">
                <Button variant="outline" className={clinicSite ? clinicOutlineBtn : "rounded-xl"}>
                  חזרה לעמוד הבית
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
