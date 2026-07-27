import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, CreditCard, CheckCircle2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { getClinicSite } from "@/lib/clinicSite";
import {
  clinicGlassCard,
  clinicGlassPanel,
  clinicIconSurface,
  clinicPrimaryBtn,
  clinicTextHeading,
  clinicTextMuted,
  clinicTextPrimary,
} from "@/lib/clinicUi";
import {
  buildDynamicPayboxUrl,
  getPayboxPaymentDetails,
  openPayboxLink,
  resolvePayboxLink,
} from "@/lib/paymentLinks";
import {
  createBookingRef,
  fetchPelecardStatus,
  initPelecardSession,
  isPelecardReturnMessage,
} from "@/lib/pelecard";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { getClinicTenantId } from "@/lib/tenant";

const PHONE = "0549000301";
const BIT_LOGO = "/payment/bit-logo.png";
const PAYBOX_LOGO = "/payment/paybox-logo.png";

function tryOpenBitApp() {
  if (typeof navigator === "undefined") return "desktop";

  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) {
    window.location.href =
      "intent://#Intent;package=com.bnhp.payments.paymentsapp;scheme=bit;end";
    return "android";
  }
  if (/iPhone|iPad|iPod/i.test(ua)) {
    window.location.href = "https://apps.apple.com/il/app/bit/id1182007739";
    return "ios";
  }
  return "desktop";
}

export default function PaymentStep({
  formData,
  treatment,
  onConfirm,
  onBack,
  isSubmitting,
}) {
  const appointments = formData.appointments || [];
  const unitPrice = treatment?.price ?? 250;
  const totalPrice = unitPrice * appointments.length;
  const [bitGuideOpen, setBitGuideOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [pelecardConfigured, setPelecardConfigured] = useState(null);
  const [iframeUrl, setIframeUrl] = useState("");
  const [bookingRef, setBookingRef] = useState("");
  const [initError, setInitError] = useState("");
  const [isInitLoading, setIsInitLoading] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);
  const clinicSite = getClinicSite();
  const bitQrImage = clinicSite?.bitQrImage;
  const payboxLink = resolvePayboxLink(treatment, clinicSite);
  const { toast } = useToast();
  const navigate = useNavigate();

  const payboxDetails = useMemo(
    () => getPayboxPaymentDetails(payboxLink, totalPrice),
    [payboxLink, totalPrice],
  );
  const payboxUrl = payboxLink ? payboxDetails.url : buildDynamicPayboxUrl(PHONE, totalPrice);

  const bitUrl = `https://www.bitpay.co.il/app/pay?phone=${PHONE}&amount=${totalPrice}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const status = await fetchPelecardStatus();
      if (cancelled) return;
      const configured = Boolean(status?.configured);
      setPelecardConfigured(configured);
      if (!configured) setPaymentMethod("bit");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (pelecardConfigured !== true || paymentMethod !== "card" || paymentDone) return;

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
      } catch (error) {
        if (cancelled) return;
        setInitError(error?.message || "לא ניתן לפתוח את דף הסליקה");
        setPelecardConfigured(false);
        setPaymentMethod("bit");
        toast({
          title: "סליקת אשראי לא זמינה כרגע",
          description: "אפשר לשלם בביט או PayBox.",
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
    pelecardConfigured,
    paymentMethod,
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
    if (paymentMethod !== "card" || paymentDone) return;

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
  }, [paymentMethod, paymentDone, bookingRef, navigate]);

  const handleBitClick = () => {
    setPaymentMethod("bit");
    setBitGuideOpen(true);
    tryOpenBitApp();
  };

  const handleOpenPaybox = () => {
    setPaymentMethod("paybox");
    const result = openPayboxLink(payboxLink);
    if (result?.opened) {
      toast({
        title: "נפתח קישור התשלום",
        description: result.instructionText,
      });
      return;
    }
    if (result?.missingConfig) {
      toast({
        title: "קישור PayBox חסר",
        description: "יש להגדיר קישור PayBox בהגדרות הקליניקה.",
        variant: "destructive",
      });
    }
  };

  const showManualConfirm = paymentMethod !== "card" || pelecardConfigured === false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`px-2 py-8 ${clinicSite ? `${clinicGlassPanel} p-6 md:p-8` : ""}`}
      dir="rtl"
    >
      <div className="text-center mb-8">
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
            clinicSite
              ? clinicIconSurface
              : "bg-primary/10"
          }`}
        >
          <CreditCard className={`w-8 h-8 ${clinicSite ? clinicTextPrimary : "text-primary"}`} />
        </div>
        <h2 className={`mb-2 text-2xl font-bold tracking-tight ${clinicSite ? clinicTextHeading : "text-foreground"}`}>
          תשלום על התור
        </h2>
        <p className={clinicSite ? clinicTextMuted : "text-muted-foreground"}>
          לפני אישור התור, יש לשלם את עלות הטיפול
        </p>
      </div>

      <div
        className={`mb-6 space-y-2 rounded-2xl p-5 text-sm ${clinicSite ? clinicGlassCard : "bg-muted/50"}`}
      >
        <div className="flex justify-between">
          <span className={clinicSite ? clinicTextMuted : "text-muted-foreground"}>טיפול:</span>
          <span className={`font-medium ${clinicSite ? clinicTextHeading : ""}`}>{treatment?.name}</span>
        </div>
        <div className="space-y-2">
          <span className={clinicSite ? clinicTextMuted : "text-muted-foreground"}>תורים:</span>
          <div className="space-y-1">
            {appointments.map((appointment) => (
              <div key={`${appointment.date}-${appointment.time}`} className="flex justify-between">
                <span className={`font-medium ${clinicSite ? clinicTextHeading : ""}`}>
                  {format(new Date(appointment.date + "T00:00:00"), "dd/MM/yyyy")}
                </span>
                <span className={`font-medium ${clinicSite ? clinicTextHeading : ""}`}>{appointment.time}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-between">
          <span className={clinicSite ? clinicTextMuted : "text-muted-foreground"}>כמות תורים:</span>
          <span className={`font-medium ${clinicSite ? clinicTextHeading : ""}`}>{appointments.length}</span>
        </div>
        <div className={`mt-2 flex justify-between border-t pt-2 ${clinicSite ? "border-[#E8ECE8]" : "border-border"}`}>
          <span className={clinicSite ? clinicTextMuted : "text-muted-foreground"}>לתשלום:</span>
          <span className={`text-lg font-bold ${clinicSite ? clinicTextPrimary : "text-foreground"}`}>₪{totalPrice}</span>
        </div>
      </div>

      <p className={`mb-3 text-center text-sm font-semibold ${clinicSite ? clinicTextHeading : "text-foreground"}`}>
        אמצעי תשלום
      </p>
      <div className="mb-6 flex flex-wrap items-start justify-center gap-8">
        {pelecardConfigured !== false && (
          <button
            type="button"
            onClick={() => setPaymentMethod("card")}
            className={`inline-flex shrink-0 flex-col items-center gap-1 transition-transform hover:opacity-85 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F6B4F] ${
              paymentMethod === "card" ? "scale-105 opacity-100" : "opacity-90"
            }`}
            aria-label="תשלום בכרטיס אשראי"
            aria-pressed={paymentMethod === "card"}
          >
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                paymentMethod === "card"
                  ? "bg-[#2F6B4F] text-white"
                  : clinicSite
                    ? "bg-[#E8F0EA] text-[#2F6B4F]"
                    : "bg-muted text-foreground"
              }`}
            >
              <CreditCard className="h-6 w-6" />
            </div>
            <span
              className={`text-xs font-semibold uppercase tracking-wide ${
                clinicSite ? "text-[#5D7F6D]" : "text-[#6B746F]"
              }`}
            >
              אשראי
            </span>
          </button>
        )}

        {bitQrImage ? (
          <button
            type="button"
            onClick={handleBitClick}
            className={`inline-flex shrink-0 flex-col items-center gap-1 transition-transform hover:opacity-85 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0079C1] ${
              paymentMethod === "bit" && bitGuideOpen ? "scale-105 opacity-100" : "opacity-90"
            }`}
            aria-label={`תשלום ₪${totalPrice} בביט`}
            aria-expanded={bitGuideOpen}
          >
            <img
              src={BIT_LOGO}
              alt="ביט"
              className="block h-12 w-auto max-w-[120px] object-contain"
              width={48}
              height={48}
            />
            <span
              className={`text-xs font-semibold uppercase tracking-wide ${
                clinicSite ? "text-[#5D7F6D]" : "text-[#6B746F]"
              }`}
            >
              BIT
            </span>
          </button>
        ) : (
          <a
            href={bitUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setPaymentMethod("bit")}
            className="inline-flex shrink-0 flex-col items-center gap-1 transition-transform hover:opacity-85 active:scale-95"
            aria-label={`תשלום ₪${totalPrice} בביט`}
          >
            <img
              src={BIT_LOGO}
              alt="ביט"
              className="block h-12 w-auto max-w-[120px] object-contain"
              width={48}
              height={48}
            />
            <span
              className={`text-xs font-semibold uppercase tracking-wide ${
                clinicSite ? "text-[#5D7F6D]" : "text-[#6B746F]"
              }`}
            >
              BIT
            </span>
          </a>
        )}

        {payboxLink ? (
          <button
            type="button"
            onClick={handleOpenPaybox}
            className="inline-flex shrink-0 flex-col items-center gap-1 opacity-90 transition-transform hover:opacity-85 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7B3FBE]"
            aria-label="תשלום ב-PayBox"
          >
            <img
              src={PAYBOX_LOGO}
              alt="Paybox"
              className="block h-12 w-auto max-w-[120px] object-contain"
              width={48}
              height={48}
            />
            <span
              className={`text-xs font-semibold uppercase tracking-wide ${
                clinicSite ? "text-[#5D7F6D]" : "text-[#6B746F]"
              }`}
            >
              PAYBOX
            </span>
          </button>
        ) : (
          <a
            href={payboxUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setPaymentMethod("paybox")}
            className="inline-flex shrink-0 flex-col items-center gap-1 transition-transform hover:opacity-85 active:scale-95"
            aria-label="תשלום ב-PayBox"
          >
            <img
              src={PAYBOX_LOGO}
              alt="Paybox"
              className="block h-12 w-auto max-w-[120px] object-contain"
              width={48}
              height={48}
            />
            <span
              className={`text-xs font-semibold uppercase tracking-wide ${
                clinicSite ? "text-[#5D7F6D]" : "text-[#6B746F]"
              }`}
            >
              PAYBOX
            </span>
          </a>
        )}
      </div>

      {paymentMethod === "card" && pelecardConfigured && (
        <div className="mb-6">
          {isInitLoading || paymentDone ? (
            <div
              className={`flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border p-6 text-center ${
                clinicSite ? "border-[#E8ECE8] bg-white/70" : "border-border bg-muted/30"
              }`}
            >
              <Loader2 className={`h-7 w-7 animate-spin ${clinicSite ? clinicTextPrimary : "text-primary"}`} />
              <p className={`text-sm ${clinicSite ? clinicTextMuted : "text-muted-foreground"}`}>
                {paymentDone
                  ? "מעבירים לדף האישור…"
                  : "טוענים את דף הסליקה המאובטח…"}
              </p>
            </div>
          ) : iframeUrl ? (
            <div
              className={`overflow-hidden rounded-[20px] border shadow-[0_8px_30px_rgba(0,0,0,0.05)] ${
                clinicSite ? "border-[#E8ECE8] bg-white" : "border-border bg-background"
              }`}
            >
              <div
                className={`border-b px-4 py-2.5 text-center text-xs font-medium ${
                  clinicSite
                    ? "border-[#E8ECE8] bg-[#F0F4F1] text-[#5D7F6D]"
                    : "border-border bg-muted text-muted-foreground"
                }`}
              >
                דף תשלום מאובטח · SSL
              </div>
              <iframe
                title="סליקת אשראי Pelecard"
                src={iframeUrl}
                className="h-[560px] w-full border-0 bg-[#F7F8F6]"
                allow="payment *"
              />
            </div>
          ) : (
            <p className={`text-center text-sm ${clinicSite ? clinicTextMuted : "text-muted-foreground"}`}>
              {initError || "דף הסליקה לא זמין כרגע."}
            </p>
          )}
        </div>
      )}

      {bitQrImage && paymentMethod === "bit" && bitGuideOpen && (
        <div className="mb-6 flex flex-col items-center rounded-xl border-2 border-[#0079C1]/30 bg-[#0079C1]/5 p-4 text-center text-sm">
          <p className="mb-3 font-semibold text-[#0079C1]">
            סרקו את הברקוד לתשלום בביט על סך ₪{totalPrice.toLocaleString("he-IL")}
          </p>
          <div className="flex w-full justify-center">
            <div className="mx-auto max-w-[200px] overflow-hidden rounded-xl border border-[#0079C1]/30 bg-white p-2">
              <img
                src={bitQrImage}
                alt="ברקוד לתשלום בביט"
                className="mx-auto block h-auto w-full object-contain"
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            פתחו ביט בטלפון וסרקו את הקוד. לאחר התשלום לחצו "שילמתי — אשר את התור".
          </p>
        </div>
      )}

      {showManualConfirm && (
        <Button
          onClick={() => onConfirm?.({ paid: false })}
          disabled={isSubmitting}
          size="lg"
          className={`mb-3 w-full gap-2 text-lg ${clinicSite ? clinicPrimaryBtn : "rounded-xl py-6"}`}
        >
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <CheckCircle2 className="w-5 h-5" />
          )}
          {isSubmitting ? "שולח..." : "שילמתי — אשר את התור"}
        </Button>
      )}

      <button
        type="button"
        onClick={onBack}
        className={`flex w-full items-center justify-center gap-1 py-2 text-sm transition-colors ${
          clinicSite
            ? `${clinicTextMuted} hover:text-[#5D7F6D]`
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <ArrowRight className="w-4 h-4" />
        חזרה לטופס
      </button>
    </motion.div>
  );
}
