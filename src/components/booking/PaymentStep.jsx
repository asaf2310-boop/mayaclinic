import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, CreditCard, Loader2, Lock, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { getClinicSite } from "@/lib/clinicSite";
import {
  clinicTextHeading,
  clinicTextMuted,
  clinicTextPrimary,
} from "@/lib/clinicUi";
import {
  createBookingRef,
  fetchPelecardStatus,
  initPelecardSession,
  isPelecardReturnMessage,
} from "@/lib/pelecard";
import { createMeridianBooking } from "@/lib/meridianBooking";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { getClinicTenantId } from "@/lib/tenant";
import BookingSuccess from "./BookingSuccess";

const VISA_LOGO = "/payment/visa-logo.svg";
const MASTERCARD_LOGO = "/payment/mastercard-logo.svg";

/**
 * Desktop iframe: tall frame so wallet rows + fields + green pay fit.
 * Mobile uses a full-page redirect (see effect below) — iframe scrolling is unreliable on iOS.
 */
const PELECARD_IFRAME_HEIGHT_CLASS =
  "min-h-[1600px] h-[1600px] md:min-h-[1400px] md:h-[max(1400px,calc(100dvh-5rem))]";
const PELECARD_IFRAME_STYLE = {
  overflow: "auto",
  display: "block",
  width: "100%",
};

function preferFullPagePelecard() {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(max-width: 900px), (pointer: coarse)").matches;
  } catch {
    return window.innerWidth <= 900;
  }
}

function SummaryRow({ label, value, mutedClass, valueClass, emphasize = false }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className={`shrink-0 ${mutedClass}`}>{label}</span>
      <span
        className={`min-w-0 break-words text-left font-medium ${valueClass} ${
          emphasize ? "text-base font-bold sm:text-lg" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default function PaymentStep({
  formData,
  treatment,
  onBack,
  paymentMethod = "credit",
}) {
  const isMeridian = paymentMethod === "meridian";
  const appointments = formData.appointments || [];
  const unitPrice = treatment?.price ?? 250;
  const totalPrice = unitPrice * appointments.length;
  const [showCheckout, setShowCheckout] = useState(false);
  const [pelecardConfigured, setPelecardConfigured] = useState(null);
  const [iframeUrl, setIframeUrl] = useState("");
  const [bookingRef, setBookingRef] = useState("");
  const [initError, setInitError] = useState("");
  const [isInitLoading, setIsInitLoading] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);
  const [isMeridianSubmitting, setIsMeridianSubmitting] = useState(false);
  const [meridianSuccess, setMeridianSuccess] = useState(null);
  const [isFullPageRedirecting, setIsFullPageRedirecting] = useState(false);
  const fullPageRedirectStarted = useRef(false);
  const clinicSite = getClinicSite();
  const meridianUrl = clinicSite?.heroMeridianLink?.url || "";
  const { toast } = useToast();
  const navigate = useNavigate();

  const mutedClass = clinicSite ? clinicTextMuted : "text-muted-foreground";
  const valueClass = clinicSite ? clinicTextHeading : "text-foreground";
  const primaryClass = clinicSite ? clinicTextPrimary : "text-foreground";

  useEffect(() => {
    if (isMeridian) {
      setPelecardConfigured(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const status = await fetchPelecardStatus();
      if (cancelled) return;
      setPelecardConfigured(Boolean(status?.configured));
    })();
    return () => {
      cancelled = true;
    };
  }, [isMeridian]);

  useEffect(() => {
    if (isMeridian || !showCheckout || pelecardConfigured !== true || paymentDone) return;

    let cancelled = false;
    (async () => {
      setIsInitLoading(true);
      setInitError("");
      setIframeUrl("");
      try {
        const ref = createBookingRef();
        const session = await initPelecardSession({
          amount: totalPrice,
          bookingRef: ref,
          treatmentName: treatment?.name || formData.treatment_name || "",
          booking: {
            patient_name: formData.patient_name,
            patient_phone: formData.patient_phone,
            patient_email: formData.patient_email,
            notes: formData.notes,
            marketing_consent: formData.marketing_consent,
            treatment_id: formData.treatment_id || treatment?.id,
            treatment_name: formData.treatment_name || treatment?.name,
            treatment_price: treatment?.price ?? formData.treatment_price ?? null,
            tenant_id: getClinicTenantId() || clinicSite?.id || "maya",
            appointments: formData.appointments || [],
          },
        });
        if (cancelled) return;
        setBookingRef(session.bookingRef || ref);
        setIframeUrl(session.url || "");
        if (typeof console !== "undefined" && session?.cssUrl) {
          console.info("[pelecard] CssURL", session.cssUrl, "LogoURL", session.logoUrl || "");
        }
      } catch (error) {
        if (cancelled) return;
        setInitError(error?.message || "לא ניתן לפתוח את דף הסליקה");
        toast({
          title: "סליקת אשראי לא זמינה כרגע",
          description: error?.message || "נסו שוב בעוד רגע או צרו קשר עם הקליניקה.",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setIsInitLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isMeridian,
    showCheckout,
    pelecardConfigured,
    paymentDone,
    totalPrice,
    treatment?.name,
    treatment?.id,
    treatment?.price,
    formData,
    clinicSite?.id,
    toast,
  ]);

  // On phones, Pelecard's wallet UI clips fields/pay button inside an iframe.
  // Open the gateway as a full page — FeedbackOnTop returns to our success/failure URLs.
  // Important: do NOT schedule location change in a timeout that React cleanup can cancel
  // when setIsFullPageRedirecting causes a re-render (that left users stuck on this screen).
  useEffect(() => {
    if (isMeridian || !showCheckout || paymentDone || !iframeUrl) return;
    if (fullPageRedirectStarted.current) return;
    if (!preferFullPagePelecard()) return;

    fullPageRedirectStarted.current = true;
    setIsFullPageRedirecting(true);
    window.location.assign(iframeUrl);
  }, [isMeridian, showCheckout, paymentDone, iframeUrl]);

  useEffect(() => {
    if (isMeridian || !showCheckout || paymentDone) return;

    function onMessage(event) {
      if (!isPelecardReturnMessage(event)) return;
      const data = event.data;
      const ref = data.bookingRef || data.paramX || data.userKey || bookingRef;
      setPaymentDone(true);

      if (data.redirectUrl) {
        window.location.assign(data.redirectUrl);
        return;
      }

      if (data.ok) {
        const redirect = data.sessionToken
          ? `/payment/success?ref=${encodeURIComponent(ref || "")}&token=${encodeURIComponent(data.sessionToken)}`
          : `/payment/success?ref=${encodeURIComponent(ref || "")}`;
        navigate(redirect, { replace: true });
      } else {
        const tokenQuery = data.sessionToken
          ? `&token=${encodeURIComponent(data.sessionToken)}`
          : "";
        navigate(
          `/payment/failure?ref=${encodeURIComponent(ref || "")}${tokenQuery}&code=${encodeURIComponent(data.pelecardStatusCode || "error")}`,
          { replace: true }
        );
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [isMeridian, showCheckout, paymentDone, bookingRef, navigate]);

  const handleStartCreditPayment = () => {
    if (pelecardConfigured === false) {
      toast({
        title: "סליקת אשראי לא מוגדרת",
        description: "יש להגדיר פרטי Pelecard בשרת לפני תשלום באשראי.",
        variant: "destructive",
      });
      return;
    }
    setShowCheckout(true);
  };

  const handleMeridianPayment = async () => {
    if (!meridianUrl) {
      toast({
        title: "קישור מרידיאן חסר",
        description: "נא ליצור קשר עם הקליניקה להשלמת התשלום.",
        variant: "destructive",
      });
      return;
    }

    setIsMeridianSubmitting(true);
    try {
      const result = await createMeridianBooking({
        patient_name: formData.patient_name,
        patient_phone: formData.patient_phone,
        patient_email: formData.patient_email,
        notes: formData.notes,
        marketing_consent: formData.marketing_consent,
        treatment_id: formData.treatment_id || treatment?.id,
        treatment_name: formData.treatment_name || treatment?.name,
        treatment_price: treatment?.price ?? formData.treatment_price ?? null,
        tenant_id: getClinicTenantId() || clinicSite?.id || "maya",
        appointments: formData.appointments || [],
      });

      window.open(meridianUrl, "_blank", "noopener,noreferrer");

      setMeridianSuccess({
        appointments: result.appointments || [],
        treatment_name: treatment?.name || formData.treatment_name,
        treatment_price: treatment?.price ?? formData.treatment_price ?? null,
      });
    } catch (error) {
      toast({
        title: "לא ניתן לשמור את התור",
        description: error?.message || "נסו שוב בעוד רגע או צרו קשר עם הקליניקה.",
        variant: "destructive",
      });
    } finally {
      setIsMeridianSubmitting(false);
    }
  };

  if (meridianSuccess) {
    return (
      <BookingSuccess
        appointment={meridianSuccess}
        hidePrices
        onReset={() => navigate("/book", { replace: true })}
      />
    );
  }

  const ctaClass = clinicSite
    ? "rounded-2xl bg-[#5D7F6D] text-white shadow-[0_8px_24px_rgba(93,127,109,0.22)] hover:bg-[#4F6F5F]"
    : "rounded-xl bg-primary text-primary-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative w-full max-w-full ${
        showCheckout
          ? "overflow-visible p-0"
          : clinicSite
            ? "overflow-hidden rounded-2xl border border-[#D5E0D8]/80 bg-gradient-to-b from-[#F3F7F4]/95 via-[#EAF1EC]/90 to-[#F7F8F6]/95 p-4 shadow-[0_12px_36px_rgba(93,127,109,0.1)] backdrop-blur-[18px] sm:rounded-[28px] sm:p-6 md:p-8"
            : "overflow-hidden py-4"
      }`}
      dir="rtl"
    >
      {clinicSite && !showCheckout && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute -left-20 top-6 hidden h-40 w-40 rounded-full bg-[#5D7F6D]/10 blur-3xl sm:block"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 bottom-16 hidden h-48 w-48 rounded-full bg-[#A8C4B4]/20 blur-3xl sm:block"
          />
        </>
      )}

      <div className={`relative text-center ${showCheckout ? "mb-3" : "mb-5 sm:mb-7"}`}>
        {!showCheckout && (
          <div
            className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl sm:mb-4 sm:h-16 sm:w-16 ${
              clinicSite
                ? "border border-[#D5E0D8] bg-[#F0F4F1]/90 shadow-[0_8px_24px_rgba(93,127,109,0.1)]"
                : "bg-primary/10"
            }`}
          >
            {isMeridian ? (
              <ShieldCheck className={`h-6 w-6 sm:h-8 sm:w-8 ${clinicSite ? clinicTextPrimary : "text-primary"}`} />
            ) : (
              <CreditCard className={`h-6 w-6 sm:h-8 sm:w-8 ${clinicSite ? clinicTextPrimary : "text-primary"}`} />
            )}
          </div>
        )}
        <h2
          className={`font-bold tracking-tight ${
            showCheckout ? "mb-0 text-base sm:text-lg" : "mb-1.5 text-xl sm:mb-2 sm:text-2xl"
          } ${clinicSite ? clinicTextHeading : "text-foreground"}`}
        >
          {showCheckout
            ? "השלמת תשלום מאובטח"
            : isMeridian
              ? "תשלום דרך מרידיאן"
              : "תשלום על התור"}
        </h2>
        {!showCheckout && (
          <p className={`mx-auto max-w-sm text-sm leading-relaxed sm:text-base ${mutedClass}`}>
            {isMeridian
              ? "השלימו את התשלום בהטבה דרך מרידיאן לאישור התור"
              : "לפני אישור התור, יש לשלם את עלות הטיפול בכרטיס אשראי"}
          </p>
        )}
      </div>

      {!showCheckout && (
        <div
          className={`relative mb-5 space-y-3 rounded-2xl p-4 text-sm sm:mb-6 sm:p-5 ${
            clinicSite
              ? "border border-[#D5E0D8]/90 bg-[#F7FAF8]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
              : "bg-muted/50"
          }`}
        >
          <SummaryRow
            label="טיפול"
            value={treatment?.name || "—"}
            mutedClass={mutedClass}
            valueClass={valueClass}
          />

          <div className="space-y-2">
            <span className={mutedClass}>תורים</span>
            <div className="space-y-1.5">
              {appointments.map((appointment) => (
                <div
                  key={`${appointment.date}-${appointment.time}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2"
                >
                  <span className={`font-medium ${valueClass}`}>
                    {format(new Date(appointment.date + "T00:00:00"), "dd/MM/yyyy")}
                  </span>
                  <span className={`tabular-nums font-semibold ${primaryClass}`}>
                    {appointment.time}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {appointments.length > 1 && (
            <SummaryRow
              label="כמות תורים"
              value={appointments.length}
              mutedClass={mutedClass}
              valueClass={valueClass}
            />
          )}

          {!isMeridian && (
            <div
              className={`flex items-center justify-between gap-3 border-t pt-3 ${
                clinicSite ? "border-[#E8ECE8]" : "border-border"
              }`}
            >
              <span className={mutedClass}>לתשלום</span>
              <span className={`text-xl font-bold tabular-nums ${primaryClass}`}>
                ₪{totalPrice}
              </span>
            </div>
          )}
        </div>
      )}

      {showCheckout && (
        <div
          className={`relative mb-3 flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-sm sm:px-4 sm:py-3 ${
            clinicSite
              ? "border border-[#D5E0D8]/90 bg-[#F7FAF8]/80 text-[#2F3B34]"
              : "bg-muted/50"
          }`}
        >
          <span className={`min-w-0 truncate ${mutedClass}`}>{treatment?.name}</span>
          {!isMeridian && (
            <span className={`shrink-0 font-bold tabular-nums ${primaryClass}`}>₪{totalPrice}</span>
          )}
        </div>
      )}

      {!showCheckout ? (
        <div className="mb-4 sm:mb-6">
          {isMeridian ? (
            <>
              <button
                type="button"
                onClick={handleMeridianPayment}
                disabled={isMeridianSubmitting || !meridianUrl}
                className={`mb-2.5 flex w-full items-center justify-center gap-2.5 px-4 py-3.5 text-[15px] font-semibold transition-transform active:scale-[0.99] disabled:opacity-60 sm:gap-3 sm:px-6 sm:py-4 sm:text-base ${ctaClass}`}
                aria-label="תשלום דרך מרידיאן"
              >
                {isMeridianSubmitting ? (
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
                ) : (
                  <ShieldCheck className="h-5 w-5 shrink-0" />
                )}
                <span className="leading-none">
                  {isMeridianSubmitting ? "שומרים את התור…" : "תשלום דרך מרידיאן"}
                </span>
              </button>
              <p className={`px-1 text-center text-xs leading-relaxed sm:text-[13px] ${mutedClass}`}>
                התור יישמר ואז ייפתח אתר מרידיאן להשלמת התשלום בהטבה
              </p>
              {!meridianUrl && (
                <p className="mt-2 text-center text-sm text-[#9B2C2C]">
                  קישור מרידיאן לא הוגדר. נא ליצור קשר עם הקליניקה.
                </p>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleStartCreditPayment}
                disabled={pelecardConfigured === null}
                className={`mb-2.5 flex w-full flex-col items-center justify-center gap-2 px-4 py-3.5 text-[15px] font-semibold transition-transform active:scale-[0.99] disabled:opacity-60 sm:gap-2.5 sm:px-6 sm:py-4 sm:text-base ${ctaClass}`}
                aria-label={`תשלום באשראי על סך ₪${totalPrice}`}
              >
                <span className="inline-flex items-center justify-center gap-2 leading-none">
                  <Lock className="h-4 w-4 shrink-0" />
                  <span>תשלום באשראי · ₪{totalPrice}</span>
                </span>
                <span className="inline-flex items-center justify-center gap-2 leading-none">
                  <img
                    src={VISA_LOGO}
                    alt="Visa"
                    className="h-5 w-auto rounded-[4px] bg-white shadow-sm sm:h-6"
                    width={42}
                    height={28}
                  />
                  <img
                    src={MASTERCARD_LOGO}
                    alt="Mastercard"
                    className="h-5 w-auto rounded-[4px] bg-white shadow-sm sm:h-6"
                    width={42}
                    height={28}
                  />
                </span>
              </button>
              <p className={`text-center text-xs sm:text-[13px] ${mutedClass}`}>
                תשלום מאובטח בדף סליקה · Visa ו־Mastercard
              </p>
              {pelecardConfigured === false && (
                <p className="mt-2 text-center text-sm text-[#9B2C2C]">
                  סליקת אשראי עדיין לא הוגדרה בשרת.
                </p>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="mb-3 w-full max-w-full sm:mb-4">
          {isInitLoading || paymentDone || isFullPageRedirecting ? (
            <div
              className={`flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border p-6 text-center ${
                clinicSite
                  ? "border-[#D5E0D8] bg-gradient-to-b from-[#F3F7F4]/90 to-[#EAF1EC]/80"
                  : "border-border bg-muted/30"
              }`}
            >
              <Loader2
                className={`h-7 w-7 animate-spin ${
                  clinicSite ? clinicTextPrimary : "text-primary"
                }`}
              />
              <p className={`text-sm ${mutedClass}`}>
                {paymentDone
                  ? "מעבירים לדף האישור…"
                  : isFullPageRedirecting
                    ? "פותחים את דף התשלום המאובטח…"
                    : "טוענים את דף הסליקה המאובטח…"}
              </p>
              {isFullPageRedirecting && iframeUrl && (
                <a
                  href={iframeUrl}
                  className={`mt-3 inline-flex w-full max-w-xs items-center justify-center rounded-2xl px-5 py-3.5 text-sm font-semibold text-white ${
                    clinicSite
                      ? "bg-[#5D7F6D] shadow-[0_8px_24px_rgba(93,127,109,0.22)]"
                      : "bg-primary"
                  }`}
                >
                  המשך לתשלום מאובטח
                </a>
              )}
            </div>
          ) : iframeUrl ? (
            <div
              className={`w-full max-w-full overflow-visible rounded-xl border sm:rounded-2xl ${
                clinicSite
                  ? "border-[#D5E0D8] bg-[#F3F7F4]"
                  : "border-border bg-background"
              }`}
            >
              <div
                className={`flex items-center justify-center gap-2 border-b px-3 py-2 text-xs font-semibold sm:gap-2.5 sm:px-4 sm:py-2.5 ${
                  clinicSite
                    ? "border-[#D5E0D8] bg-[#F0F4F1]/95 text-[#5D7F6D]"
                    : "border-border bg-muted text-muted-foreground"
                }`}
              >
                <Lock className="h-3.5 w-3.5 shrink-0" />
                <span>תשלום מאובטח</span>
                <span className="opacity-40">·</span>
                <img src={VISA_LOGO} alt="" className="h-4 w-auto sm:h-5" width={36} height={24} />
                <img src={MASTERCARD_LOGO} alt="" className="h-4 w-auto sm:h-5" width={36} height={24} />
              </div>
              <iframe
                title="סליקת אשראי Pelecard"
                src={iframeUrl}
                scrolling="yes"
                className={`w-full max-w-full border-0 ${PELECARD_IFRAME_HEIGHT_CLASS} ${
                  clinicSite ? "bg-white" : "bg-background"
                }`}
                style={PELECARD_IFRAME_STYLE}
                allow="payment *"
              />
            </div>
          ) : (
            <p className={`text-center text-sm ${mutedClass}`}>
              {initError || "דף הסליקה לא זמין כרגע."}
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          if (showCheckout && !paymentDone) {
            setShowCheckout(false);
            setIframeUrl("");
            setInitError("");
            return;
          }
          onBack?.();
        }}
        className={`relative flex w-full items-center justify-center gap-1 py-2.5 text-sm transition-colors ${
          clinicSite
            ? `${clinicTextMuted} hover:text-[#5D7F6D]`
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <ArrowRight className="h-4 w-4" />
        {showCheckout && !paymentDone ? "חזרה לסיכום התשלום" : "חזרה לטופס"}
      </button>
    </motion.div>
  );
}
