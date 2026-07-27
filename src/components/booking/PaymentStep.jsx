import React, { useEffect, useState } from "react";
import { ArrowRight, CreditCard, Loader2, Lock } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { getClinicSite } from "@/lib/clinicSite";
import {
  clinicGlassCard,
  clinicGlassPanel,
  clinicIconSurface,
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
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { getClinicTenantId } from "@/lib/tenant";

const VISA_LOGO = "/payment/visa-logo.svg";
const MASTERCARD_LOGO = "/payment/mastercard-logo.svg";

export default function PaymentStep({ formData, treatment, onBack }) {
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
  const clinicSite = getClinicSite();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const status = await fetchPelecardStatus();
      if (cancelled) return;
      setPelecardConfigured(Boolean(status?.configured));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showCheckout || pelecardConfigured !== true || paymentDone) return;

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
    if (!showCheckout || paymentDone) return;

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
        navigate(`/payment/success?ref=${encodeURIComponent(ref || "")}`, { replace: true });
      } else {
        navigate(
          `/payment/failure?ref=${encodeURIComponent(ref || "")}&code=${encodeURIComponent(data.pelecardStatusCode || "error")}`,
          { replace: true }
        );
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [showCheckout, paymentDone, bookingRef, navigate]);

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`px-2 py-8 ${clinicSite ? `${clinicGlassPanel} p-6 md:p-8` : ""}`}
      dir="rtl"
    >
      <div className="mb-8 text-center">
        <div
          className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${
            clinicSite ? clinicIconSurface : "bg-primary/10"
          }`}
        >
          <CreditCard className={`h-8 w-8 ${clinicSite ? clinicTextPrimary : "text-primary"}`} />
        </div>
        <h2
          className={`mb-2 text-2xl font-bold tracking-tight ${
            clinicSite ? clinicTextHeading : "text-foreground"
          }`}
        >
          תשלום על התור
        </h2>
        <p className={clinicSite ? clinicTextMuted : "text-muted-foreground"}>
          לפני אישור התור, יש לשלם את עלות הטיפול בכרטיס אשראי
        </p>
      </div>

      <div
        className={`mb-6 space-y-2 rounded-2xl p-5 text-sm ${
          clinicSite ? clinicGlassCard : "bg-muted/50"
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

      {!showCheckout ? (
        <div className="mb-6">
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
        </div>
      ) : (
        <div className="mb-6">
          {isInitLoading || paymentDone ? (
            <div
              className={`flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border p-6 text-center ${
                clinicSite ? "border-[#E8ECE8] bg-white/70" : "border-border bg-muted/30"
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
              className={`overflow-hidden rounded-[20px] border shadow-[0_8px_30px_rgba(0,0,0,0.05)] ${
                clinicSite ? "border-[#E8ECE8] bg-[#F7F8F6]" : "border-border bg-background"
              }`}
            >
              <div
                className={`flex items-center justify-center gap-2.5 border-b px-4 py-3 text-xs font-semibold ${
                  clinicSite
                    ? "border-[#E8ECE8] bg-white text-[#5D7F6D]"
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
                className="h-[580px] w-full border-0 bg-[#F7F8F6]"
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
