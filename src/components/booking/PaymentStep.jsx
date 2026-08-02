import React, { useEffect, useState } from "react";
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

/** Pelecard he-3 form needs ~890px on mobile; keep a stable tall frame (no inner scroll / layout jump). */
const PELECARD_IFRAME_HEIGHT_CLASS = "h-[max(920px,calc(100dvh-8.5rem))]";
const PELECARD_IFRAME_STYLE = {
  overflow: "hidden",
  display: "block",
};

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
  const clinicSite = getClinicSite();
  const meridianUrl = clinicSite?.heroMeridianLink?.url || "";
  const { toast } = useToast();
  const navigate = useNavigate();

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
        onReset={() => navigate("/book", { replace: true })}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden px-2 py-8 ${
        clinicSite
          ? "rounded-[28px] border border-[#D5E0D8]/80 bg-gradient-to-b from-[#F3F7F4]/92 via-[#EAF1EC]/88 to-[#F7F8F6]/90 p-6 shadow-[0_16px_48px_rgba(93,127,109,0.12)] backdrop-blur-[18px] md:p-8"
          : ""
      }`}
      dir="rtl"
    >
      {clinicSite && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute -left-16 top-8 h-48 w-48 rounded-full bg-[#5D7F6D]/12 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 bottom-20 h-56 w-56 rounded-full bg-[#A8C4B4]/25 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-8 top-0 h-32 bg-gradient-to-b from-white/35 to-transparent"
          />
        </>
      )}

      <div className={`relative text-center ${showCheckout ? "mb-4" : "mb-8"}`}>
        {!showCheckout && (
          <div
            className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${
              clinicSite
                ? "border border-[#D5E0D8] bg-[#F0F4F1]/90 shadow-[0_8px_24px_rgba(93,127,109,0.1)]"
                : "bg-primary/10"
            }`}
          >
            {isMeridian ? (
              <ShieldCheck className={`h-8 w-8 ${clinicSite ? clinicTextPrimary : "text-primary"}`} />
            ) : (
              <CreditCard className={`h-8 w-8 ${clinicSite ? clinicTextPrimary : "text-primary"}`} />
            )}
          </div>
        )}
        <h2
          className={`font-bold tracking-tight ${
            showCheckout ? "mb-0 text-lg" : "mb-2 text-2xl"
          } ${clinicSite ? clinicTextHeading : "text-foreground"}`}
        >
          {showCheckout
            ? "השלמת תשלום מאובטח"
            : isMeridian
              ? "תשלום דרך מרידיאן"
              : "תשלום על התור"}
        </h2>
        {!showCheckout && (
          <p className={clinicSite ? clinicTextMuted : "text-muted-foreground"}>
            {isMeridian
              ? "לפני אישור התור, יש להשלים את התשלום בהטבה דרך מרידיאן"
              : "לפני אישור התור, יש לשלם את עלות הטיפול בכרטיס אשראי"}
          </p>
        )}
      </div>

      {!showCheckout && (
      <div
        className={`relative mb-6 space-y-2 rounded-2xl p-5 text-sm ${
          clinicSite
            ? "border border-[#D5E0D8]/90 bg-[#F7FAF8]/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-sm"
            : "bg-muted/50"
        }`}
      >
        <div className="flex justify-between">
          <span className={clinicSite ? clinicTextMuted : "text-muted-foreground"}>טיפול:</span>
          <span className={`font-medium ${clinicSite ? clinicTextHeading : ""}`}>
            {treatment?.name}
          </span>
        </div>
        <div className="space-y-2">
          <span className={clinicSite ? clinicTextMuted : "text-muted-foreground"}>תורים:</span>
          <div className="space-y-1">
            {appointments.map((appointment) => (
              <div
                key={`${appointment.date}-${appointment.time}`}
                className="flex justify-between"
              >
                <span className={`font-medium ${clinicSite ? clinicTextHeading : ""}`}>
                  {format(new Date(appointment.date + "T00:00:00"), "dd/MM/yyyy")}
                </span>
                <span className={`font-medium ${clinicSite ? clinicTextHeading : ""}`}>
                  {appointment.time}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-between">
          <span className={clinicSite ? clinicTextMuted : "text-muted-foreground"}>
            כמות תורים:
          </span>
          <span className={`font-medium ${clinicSite ? clinicTextHeading : ""}`}>
            {appointments.length}
          </span>
        </div>
        <div
          className={`mt-2 flex justify-between border-t pt-2 ${
            clinicSite ? "border-[#E8ECE8]" : "border-border"
          }`}
        >
          <span className={clinicSite ? clinicTextMuted : "text-muted-foreground"}>לתשלום:</span>
          <span
            className={`text-lg font-bold ${clinicSite ? clinicTextPrimary : "text-foreground"}`}
          >
            ₪{totalPrice}
          </span>
        </div>
      </div>
      )}

      {showCheckout && (
        <div
          className={`relative mb-3 flex items-center justify-between rounded-2xl px-4 py-3 text-sm ${
            clinicSite
              ? "border border-[#D5E0D8]/90 bg-[#F7FAF8]/80 text-[#2F3B34]"
              : "bg-muted/50"
          }`}
        >
          <span className={clinicSite ? clinicTextMuted : "text-muted-foreground"}>
            {treatment?.name}
          </span>
          <span className={`font-bold ${clinicSite ? clinicTextPrimary : ""}`}>₪{totalPrice}</span>
        </div>
      )}

      {!showCheckout ? (
        <div className="mb-6">
          {isMeridian ? (
            <>
              <button
                type="button"
                onClick={handleMeridianPayment}
                disabled={isMeridianSubmitting || !meridianUrl}
                className={`mb-3 flex w-full items-center justify-center gap-3 px-6 py-4 text-base font-medium transition-transform active:scale-[0.99] disabled:opacity-60 ${
                  clinicSite
                    ? "rounded-2xl bg-[#5D7F6D] text-white shadow-[0_8px_24px_rgba(93,127,109,0.22)] hover:bg-[#4F6F5F]"
                    : "rounded-xl bg-primary text-primary-foreground"
                }`}
                aria-label="תשלום דרך מרידיאן"
              >
                {isMeridianSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ShieldCheck className="h-5 w-5 shrink-0" />
                )}
                <span>
                  {isMeridianSubmitting ? "שומרים את התור…" : "תשלום דרך מרידיאן"}
                </span>
              </button>
              <p
                className={`text-center text-xs ${
                  clinicSite ? clinicTextMuted : "text-muted-foreground"
                }`}
              >
                התור יישמר ואז תועברו לאתר מרידיאן להשלמת התשלום בהטבה
              </p>
              {!meridianUrl && (
                <p className="mt-3 text-center text-sm text-[#9B2C2C]">
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
                className={`mb-3 flex w-full flex-col items-center justify-center gap-2.5 px-6 py-4 text-base font-medium transition-transform active:scale-[0.99] disabled:opacity-60 ${
                  clinicSite
                    ? "rounded-2xl bg-[#5D7F6D] text-white shadow-[0_8px_24px_rgba(93,127,109,0.22)] hover:bg-[#4F6F5F]"
                    : "rounded-xl bg-primary text-primary-foreground"
                }`}
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
                    className="h-6 w-auto rounded-[4px] bg-white shadow-sm"
                    width={42}
                    height={28}
                  />
                  <img
                    src={MASTERCARD_LOGO}
                    alt="Mastercard"
                    className="h-6 w-auto rounded-[4px] bg-white shadow-sm"
                    width={42}
                    height={28}
                  />
                </span>
              </button>
              <p
                className={`text-center text-xs ${
                  clinicSite ? clinicTextMuted : "text-muted-foreground"
                }`}
              >
                תשלום מאובטח בדף סליקה · Visa ו־Mastercard
              </p>
              {pelecardConfigured === false && (
                <p className="mt-3 text-center text-sm text-[#9B2C2C]">
                  סליקת אשראי עדיין לא הוגדרה בשרת.
                </p>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="mb-4">
          {isInitLoading || paymentDone ? (
            <div
              className={`flex ${PELECARD_IFRAME_HEIGHT_CLASS} flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border p-6 text-center ${
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
              <p className={`text-sm ${clinicSite ? clinicTextMuted : "text-muted-foreground"}`}>
                {paymentDone ? "מעבירים לדף האישור…" : "טוענים את דף הסליקה המאובטח…"}
              </p>
            </div>
          ) : iframeUrl ? (
            <div
              className={`overflow-hidden rounded-[20px] border shadow-[0_12px_36px_rgba(93,127,109,0.12)] ${
                clinicSite
                  ? "border-[#D5E0D8] bg-gradient-to-b from-[#F3F7F4] to-[#E8F0EA]"
                  : "border-border bg-background"
              }`}
            >
              <div
                className={`flex items-center justify-center gap-2.5 border-b px-4 py-2.5 text-xs font-semibold ${
                  clinicSite
                    ? "border-[#D5E0D8] bg-[#F0F4F1]/95 text-[#5D7F6D]"
                    : "border-border bg-muted text-muted-foreground"
                }`}
              >
                <Lock className="h-3.5 w-3.5" />
                <span>תשלום מאובטח</span>
                <span className="opacity-40">·</span>
                <img src={VISA_LOGO} alt="" className="h-5 w-auto" width={36} height={24} />
                <img src={MASTERCARD_LOGO} alt="" className="h-5 w-auto" width={36} height={24} />
              </div>
              <iframe
                title="סליקת אשראי Pelecard"
                src={iframeUrl}
                scrolling="no"
                className={`w-full border-0 ${PELECARD_IFRAME_HEIGHT_CLASS} ${
                  clinicSite ? "bg-[#F3F7F4]" : "bg-background"
                }`}
                style={PELECARD_IFRAME_STYLE}
                allow="payment *"
              />
            </div>
          ) : (
            <p
              className={`text-center text-sm ${
                clinicSite ? clinicTextMuted : "text-muted-foreground"
              }`}
            >
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
        className={`flex w-full items-center justify-center gap-1 py-2 text-sm transition-colors ${
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
