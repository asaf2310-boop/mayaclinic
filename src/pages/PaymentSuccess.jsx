import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Navbar from "../components/layout/Navbar";
import BookingSuccess from "../components/booking/BookingSuccess";
import { fetchPelecardSession } from "@/lib/pelecard";
import { getClinicSite } from "@/lib/clinicSite";
import {
  clinicFadeIn,
  clinicGlassPanel,
  clinicPageGradient,
  clinicTextHeading,
  clinicTextMuted,
  clinicTextPrimary,
} from "@/lib/clinicUi";

const POLL_MS = 1500;
const MAX_WAIT_MS = 45000;

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const bookingRef = String(params.get("ref") || "").trim();
  const sessionToken = String(params.get("token") || "").trim();
  const navigate = useNavigate();
  const clinicSite = getClinicSite();
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!bookingRef || !sessionToken) {
      setError("קישור התשלום אינו תקין או שפג תוקפו");
      return;
    }

    let cancelled = false;
    const started = Date.now();

    async function poll() {
      try {
        const data = await fetchPelecardSession(bookingRef, sessionToken);
        if (cancelled) return;
        setSession(data);

        if (data.status === "failed") {
          navigate(
            `/payment/failure?ref=${encodeURIComponent(bookingRef)}&token=${encodeURIComponent(sessionToken)}`,
            { replace: true }
          );
          return;
        }

        if (data.status === "paid") return;

        if (Date.now() - started >= MAX_WAIT_MS) {
          setTimedOut(true);
          return;
        }

        window.setTimeout(poll, POLL_MS);
      } catch (err) {
        if (cancelled) return;
        if (Date.now() - started >= MAX_WAIT_MS) {
          setError(err?.message || "לא ניתן לטעון את סטטוס התשלום");
          return;
        }
        window.setTimeout(poll, POLL_MS);
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [bookingRef, navigate, sessionToken]);

  const appointment =
    session?.status === "paid"
      ? {
          appointments: session.appointments || [],
          treatment_name: session.treatmentName,
          treatment_price: session.treatmentPrice,
        }
      : null;

  return (
    <div
      className={`min-h-screen ${clinicSite ? `page-background ${clinicPageGradient} clinic-page-enter font-sans` : "bg-background"}`}
    >
      <Navbar />
      <main className="relative px-6 pb-16 pt-24" dir="rtl">
        <div className={`relative mx-auto max-w-2xl ${clinicSite ? clinicFadeIn : ""}`}>
          {appointment ? (
            <BookingSuccess
              appointment={appointment}
              onReset={() => navigate("/book", { replace: true })}
            />
          ) : (
            <div className={`px-6 py-16 text-center ${clinicSite ? clinicGlassPanel : ""}`}>
              {error ? (
                <>
                  <h2 className={`mb-3 text-2xl font-bold ${clinicSite ? clinicTextHeading : ""}`}>
                    לא ניתן לאשר את התשלום
                  </h2>
                  <p className={`mb-6 ${clinicSite ? clinicTextMuted : "text-muted-foreground"}`}>
                    {error}
                  </p>
                  <Link to="/book" className={clinicSite ? clinicTextPrimary : "text-primary"}>
                    חזרה לקביעת תור
                  </Link>
                </>
              ) : (
                <>
                  <Loader2
                    className={`mx-auto mb-4 h-10 w-10 animate-spin ${
                      clinicSite ? clinicTextPrimary : "text-primary"
                    }`}
                  />
                  <h2 className={`mb-2 text-2xl font-bold ${clinicSite ? clinicTextHeading : ""}`}>
                    {timedOut ? "התשלום התקבל — מאשרים את התור" : "מאשרים את התשלום…"}
                  </h2>
                  <p className={clinicSite ? clinicTextMuted : "text-muted-foreground"}>
                    {timedOut
                      ? "אם התור לא מופיע כאן תוך דקה — צרו קשר עם הקליניקה."
                      : "רגע אחד, מעדכנים את המערכת אחרי אישור הסליקה."}
                  </p>
                  {timedOut && (
                    <button
                      type="button"
                      className={`mt-6 text-sm font-semibold ${clinicSite ? clinicTextPrimary : "text-primary"}`}
                      onClick={() => window.location.reload()}
                    >
                      רענון
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
