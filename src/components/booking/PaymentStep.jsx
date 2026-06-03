import React, { useMemo, useState } from "react";
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
} from "@/lib/paymentLinks";
import { useToast } from "@/components/ui/use-toast";

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

export default function PaymentStep({ formData, treatment, onConfirm, onBack, isSubmitting }) {
  const appointments = formData.appointments || [];
  const unitPrice = treatment?.price ?? 250;
  const totalPrice = unitPrice * appointments.length;
  const [bitGuideOpen, setBitGuideOpen] = useState(false);
  const clinicSite = getClinicSite();
  const bitQrImage = clinicSite?.bitQrImage;
  const payboxLink = clinicSite?.payboxLink;
  const { toast } = useToast();

  const payboxDetails = useMemo(
    () => getPayboxPaymentDetails(payboxLink, totalPrice),
    [payboxLink, totalPrice],
  );
  const payboxUrl = payboxLink ? payboxDetails.url : buildDynamicPayboxUrl(PHONE, totalPrice);

  const bitUrl = `https://www.bitpay.co.il/app/pay?phone=${PHONE}&amount=${totalPrice}`;

  const handleBitClick = () => {
    setBitGuideOpen(true);
    tryOpenBitApp();
  };

  const handleOpenPaybox = () => {
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
      <div className="mb-4 flex items-center justify-center gap-10">
        {bitQrImage ? (
          <button
            type="button"
            onClick={handleBitClick}
            className={`inline-flex shrink-0 transition-transform hover:opacity-85 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0079C1] ${
              bitGuideOpen ? "scale-105 opacity-100" : "opacity-90"
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
          </button>
        ) : (
          <a
            href={bitUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 transition-transform hover:opacity-85 active:scale-95"
            aria-label={`תשלום ₪${totalPrice} בביט`}
          >
            <img
              src={BIT_LOGO}
              alt="ביט"
              className="block h-12 w-auto max-w-[120px] object-contain"
              width={48}
              height={48}
            />
          </a>
        )}

        {payboxLink ? (
          <button
            type="button"
            onClick={handleOpenPaybox}
            className="inline-flex shrink-0 opacity-90 transition-transform hover:opacity-85 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7B3FBE]"
            aria-label="תשלום ב-PayBox"
          >
            <img
              src={PAYBOX_LOGO}
              alt="Paybox"
              className="block h-12 w-auto max-w-[120px] object-contain"
              width={48}
              height={48}
            />
          </button>
        ) : (
          <a
            href={payboxUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 transition-transform hover:opacity-85 active:scale-95"
            aria-label="תשלום ב-PayBox"
          >
            <img
              src={PAYBOX_LOGO}
              alt="Paybox"
              className="block h-12 w-auto max-w-[120px] object-contain"
              width={48}
              height={48}
            />
          </a>
        )}
      </div>

      {bitQrImage && bitGuideOpen && (
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

      <p className={`mb-8 text-center text-xs ${clinicSite ? clinicTextMuted : "text-muted-foreground"}`}>
        {bitQrImage
          ? "לחצו על ביט לקבלת הוראות תשלום וסריקת הברקוד"
          : "הכפתורים יפתחו את האפליקציה במכשירכם"}
      </p>

      <Button
        onClick={onConfirm}
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
