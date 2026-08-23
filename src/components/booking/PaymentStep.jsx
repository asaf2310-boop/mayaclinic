import React, { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, CreditCard, Loader2, Lock, ShieldCheck, Wallet } from "lucide-react";
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
import {
  getPayboxPaymentDetails,
  openPayboxLink,
  resolvePayboxLink,
} from "@/lib/paymentLinks";
import {
  createMeridianBooking,
  verifyMeridianTreatmentId,
} from "@/lib/meridianBooking";
import { createMovementBooking } from "@/lib/movementBooking";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { getClinicTenantId } from "@/lib/tenant";
import BookingSuccess from "./BookingSuccess";

const VISA_LOGO = "/payment/visa-logo.svg";
const MASTERCARD_LOGO = "/payment/mastercard-logo.svg";

/**
 * Always embed Pelecard in an iframe (not a top-level redirect).
 * Mobile: viewport-tall scrollable frame. Desktop: taller fixed frame.
 */
const PELECARD_IFRAME_HEIGHT_CLASS =
  "h-[min(920px,calc(100dvh-9rem))] min-h-[640px] sm:h-[min(1100px,calc(100dvh-8rem))] md:min-h-[1100px] md:h-[max(1100px,calc(100dvh-6rem))]";
const PELECARD_IFRAME_STYLE = {
  overflow: "auto",
  display: "block",
  width: "100%",
  WebkitOverflowScrolling: "touch",
};

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
  const isMovement = paymentMethod === "movement";
  const hidePrices = isMeridian || isMovement || Boolean(formData?.hide_price);
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
  const [meridianTreatmentId, setMeridianTreatmentId] = useState("");
  const [isMeridianVerifying, setIsMeridianVerifying] = useState(false);
  const [meridianVerifyError, setMeridianVerifyError] = useState("");
  const [meridianAppointmentIds, setMeridianAppointmentIds] = useState([]);
  const [meridianSuccess, setMeridianSuccess] = useState(null);
  const [isMovementConfirming, setIsMovementConfirming] = useState(false);
  const [movementError, setMovementError] = useState("");
  const [movementSuccess, setMovementSuccess] = useState(null);
  const clinicSite = getClinicSite();
  const { toast } = useToast();
  const navigate = useNavigate();

  const mutedClass = clinicSite ? clinicTextMuted : "text-muted-foreground";
  const valueClass = clinicSite ? clinicTextHeading : "text-foreground";
  const primaryClass = clinicSite ? clinicTextPrimary : "text-foreground";
  const ctaClass = clinicSite
    ? "rounded-2xl bg-[#5D7F6D] text-white shadow-[0_8px_24px_rgba(93,127,109,0.22)] hover:bg-[#4F6F5F]"
    : "rounded-xl bg-primary text-primary-foreground";
  const payboxDetails = getPayboxPaymentDetails(
    resolvePayboxLink(treatment, clinicSite),
    totalPrice
  );

  useEffect(() => {
    if (isMeridian || isMovement) {
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
  }, [isMeridian, isMovement]);

  useEffect(() => {
    if (isMeridian || isMovement || !showCheckout || pelecardConfigured !== true || paymentDone) return;

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
        setIframeUrl(String(session.url || "").trim());
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
    isMovement,
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
    if (isMeridian || isMovement || !showCheckout || paymentDone) return;

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
  }, [isMeridian, isMovement, showCheckout, paymentDone, bookingRef, navigate]);

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

  const handleStartPayboxPayment = () => {
    const result = openPayboxLink(resolvePayboxLink(treatment, clinicSite));
    if (result.missingConfig) {
      toast({
        title: "קישור PayBox חסר",
        description: "לא הוגדר קישור PayBox עבור טיפול זה.",
        variant: "destructive",
      });
    }
  };

  const handleVerifyMeridianTreatmentId = async (event) => {
    event?.preventDefault?.();

    const digits = String(meridianTreatmentId || "").replace(/\D/g, "");
    if (digits.length < 6) {
      setMeridianVerifyError("נא להזין מזהה טיפול תקין ממרידיאן");
      return;
    }

    setIsMeridianVerifying(true);
    setMeridianVerifyError("");
    try {
      let appointmentIds = meridianAppointmentIds;
      let createdAppointments = [];

      if (!appointmentIds.length) {
        const created = await createMeridianBooking({
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
        appointmentIds = created.appointmentIds || [];
        createdAppointments = created.appointments || [];
        setMeridianAppointmentIds(appointmentIds);
      }

      if (!appointmentIds.length) {
        throw new Error("לא ניתן לשמור את התור לאימות");
      }

      const result = await verifyMeridianTreatmentId({
        appointmentIds,
        treatmentId: digits,
      });

      setMeridianSuccess({
        appointments: result.appointments || createdAppointments,
        treatment_name: treatment?.name || formData.treatment_name,
        treatment_price: treatment?.price ?? formData.treatment_price ?? null,
      });
    } catch (error) {
      setMeridianVerifyError(
        error?.message || "לא ניתן לאשר את המזהה. בדקו את המספר ונסו שוב."
      );
    } finally {
      setIsMeridianVerifying(false);
    }
  };

  const handleConfirmMovementBooking = async (event) => {
    event?.preventDefault?.();
    setIsMovementConfirming(true);
    setMovementError("");
    try {
      const created = await createMovementBooking({
        patient_name: formData.patient_name,
        patient_phone: formData.patient_phone,
        patient_email: formData.patient_email,
        notes: formData.notes,
        marketing_consent: formData.marketing_consent,
        treatment_id: formData.treatment_id || treatment?.id,
        treatment_name: formData.treatment_name || treatment?.name,
        treatment_price: null,
        tenant_id: getClinicTenantId() || clinicSite?.id || "maya",
        appointments: formData.appointments || [],
      });

      setMovementSuccess({
        appointments: created.appointments || [],
        treatment_name:
          created.appointments?.[0]?.treatment_name ||
          `${treatment?.name || formData.treatment_name || ""} (מובמנט · 45 דק׳)`,
        treatment_price: null,
        hide_price: true,
        patient_email: formData.patient_email,
      });
    } catch (error) {
      setMovementError(error?.message || "לא ניתן לאשר את התור. נסו שוב.");
    } finally {
      setIsMovementConfirming(false);
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

  if (movementSuccess) {
    return (
      <BookingSuccess
        appointment={movementSuccess}
        hidePrices
        onReset={() =>
          navigate(
            `/book?channel=${clinicSite?.momentBooking?.channel || "movement"}`,
            { replace: true }
          )
        }
      />
    );
  }

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

      {!showCheckout && (
        <div className="relative mb-5 text-center sm:mb-7">
          <div
            className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl sm:mb-4 sm:h-16 sm:w-16 ${
              clinicSite
                ? "border border-[#D5E0D8] bg-[#F0F4F1]/90 shadow-[0_8px_24px_rgba(93,127,109,0.1)]"
                : "bg-primary/10"
            }`}
          >
            {isMeridian ? (
              <ShieldCheck className={`h-6 w-6 sm:h-8 sm:w-8 ${clinicSite ? clinicTextPrimary : "text-primary"}`} />
            ) : isMovement ? (
              <CheckCircle2 className={`h-6 w-6 sm:h-8 sm:w-8 ${clinicSite ? clinicTextPrimary : "text-primary"}`} />
            ) : (
              <CreditCard className={`h-6 w-6 sm:h-8 sm:w-8 ${clinicSite ? clinicTextPrimary : "text-primary"}`} />
            )}
          </div>
          <h2
            className={`mb-1.5 text-xl font-bold tracking-tight sm:mb-2 sm:text-2xl ${
              clinicSite ? clinicTextHeading : "text-foreground"
            }`}
          >
            {isMeridian
              ? "אימות מזהה מרידיאן"
              : isMovement
                ? "אישור תור — לקוחות מובמנט"
                : "תשלום על התור"}
          </h2>
          <p className={`mx-auto max-w-sm text-sm leading-relaxed sm:text-base ${mutedClass}`}>
            {isMeridian
              ? "הזינו את מזהה הטיפול מאתר מרידיאן לאישור התור"
              : isMovement
                ? "תור ללקוחות מובמנט · משך כל טיפול 45 דקות · ללא תשלום באשראי"
                : "לפני אישור התור, יש לשלם את עלות הטיפול בכרטיס אשראי"}
          </p>
        </div>
      )}

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

          {!hidePrices && (
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
          {isMovement && (
            <div
              className={`border-t pt-3 text-sm ${
                clinicSite ? "border-[#E8ECE8]" : "border-border"
              } ${mutedClass}`}
            >
              לקוחות מובמנט — ללא הצגת מחיר באתר · כל תור 45 דקות
            </div>
          )}
        </div>
      )}

      {!showCheckout ? (
        <div className="mb-4 sm:mb-6">
          {isMeridian ? (
            <form onSubmit={handleVerifyMeridianTreatmentId} className="space-y-4">
              <label className="block space-y-2 text-right">
                <span className={`text-sm font-medium ${valueClass}`}>מזהה טיפול מאתר מרידיאן</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={meridianTreatmentId}
                  onChange={(event) => {
                    setMeridianTreatmentId(event.target.value.replace(/[^\d]/g, ""));
                    if (meridianVerifyError) setMeridianVerifyError("");
                  }}
                  placeholder=""
                  className={`w-full rounded-2xl border px-4 py-3 text-base tabular-nums outline-none transition focus:ring-2 ${
                    clinicSite
                      ? "border-[#D5E0D8] bg-white/90 text-[#2F3E35] placeholder:text-[#8A9A90] focus:border-[#5D7F6D] focus:ring-[#5D7F6D]/25"
                      : "border-border bg-background focus:ring-primary/30"
                  }`}
                  disabled={isMeridianVerifying}
                  aria-label="מזהה טיפול מאתר מרידיאן"
                />
              </label>

              {meridianVerifyError && (
                <p className="text-center text-sm text-[#9B2C2C]">{meridianVerifyError}</p>
              )}

              <button
                type="submit"
                disabled={
                  isMeridianVerifying ||
                  String(meridianTreatmentId).replace(/\D/g, "").length < 6
                }
                className={`flex w-full items-center justify-center gap-2.5 px-4 py-3.5 text-[15px] font-semibold transition-transform active:scale-[0.99] disabled:opacity-60 sm:gap-3 sm:px-6 sm:py-4 sm:text-base ${ctaClass}`}
                aria-label="אישור התור"
              >
                {isMeridianVerifying ? (
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
                ) : (
                  <ShieldCheck className="h-5 w-5 shrink-0" />
                )}
                <span className="leading-none">
                  {isMeridianVerifying ? "מאשרים…" : "אישור התור"}
                </span>
              </button>
            </form>
          ) : isMovement ? (
            <div className="space-y-4">
              <div
                className={`rounded-2xl border p-4 text-center text-sm leading-6 ${
                  clinicSite
                    ? "border-[#D5E0D8] bg-[#F7FAF8]/90 text-[#2F3E35]"
                    : "border-border bg-muted/40 text-foreground"
                }`}
              >
                לאחר אישור התור יישלח סיכום למייל שלכם ולקליניקה. הטיפול מיועד ללקוחות מובמנט.
              </div>

              {movementError && (
                <p className="text-center text-sm text-[#9B2C2C]">{movementError}</p>
              )}

              <button
                type="button"
                onClick={handleConfirmMovementBooking}
                disabled={isMovementConfirming}
                className={`flex w-full items-center justify-center gap-2.5 px-4 py-3.5 text-[15px] font-semibold transition-transform active:scale-[0.99] disabled:opacity-60 sm:gap-3 sm:px-6 sm:py-4 sm:text-base ${ctaClass}`}
                aria-label="אשר את התור"
              >
                {isMovementConfirming ? (
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                )}
                <span className="leading-none">
                  {isMovementConfirming ? "מאשרים תור..." : "אשר את התור"}
                </span>
              </button>
            </div>
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
              <button
                type="button"
                onClick={handleStartPayboxPayment}
                disabled={!payboxDetails.isConfigured}
                className={`mb-2.5 flex w-full items-center justify-center gap-2.5 border px-4 py-3.5 text-[15px] font-semibold transition-transform active:scale-[0.99] disabled:opacity-60 sm:gap-3 sm:px-6 sm:py-4 sm:text-base ${
                  clinicSite
                    ? "rounded-2xl border-[#D5E0D8] bg-white/90 text-[#2F3E35] hover:bg-[#F7FAF8]"
                    : "rounded-xl border-border bg-background text-foreground"
                }`}
                aria-label={`תשלום בפייבוקס על סך ${payboxDetails.amountDisplay}`}
              >
                <Wallet className="h-5 w-5 shrink-0" />
                <span className="leading-none">תשלום בפייבוקס · {payboxDetails.amountDisplay}</span>
              </button>
              <p className={`text-center text-xs sm:text-[13px] ${mutedClass}`}>
                תשלום מאובטח בדף סליקה · Visa ו־Mastercard
              </p>
              {payboxDetails.isConfigured && (
                <p className={`text-center text-xs sm:text-[13px] ${mutedClass}`}>
                  או תשלום ישיר דרך PayBox
                </p>
              )}
              {pelecardConfigured === false && (
                <p className="mt-2 text-center text-sm text-[#9B2C2C]">
                  סליקת אשראי עדיין לא הוגדרה בשרת.
                </p>
              )}
              {!payboxDetails.isConfigured && (
                <p className="mt-2 text-center text-sm text-[#9B2C2C]">
                  קישור PayBox עדיין לא הוגדר לטיפול זה.
                </p>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="mb-3 w-full max-w-full sm:mb-4">
          {isInitLoading || paymentDone ? (
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
                {paymentDone ? "מעבירים לדף האישור…" : "טוענים את דף הסליקה המאובטח…"}
              </p>
            </div>
          ) : iframeUrl ? (
            <div
              className={`w-full max-w-full overflow-hidden rounded-xl border sm:rounded-2xl ${
                clinicSite
                  ? "border-[#D5E0D8] bg-white"
                  : "border-border bg-background"
              }`}
            >
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
