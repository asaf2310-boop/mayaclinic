import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Copy, CreditCard, CheckCircle2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { getClinicSite } from "@/lib/clinicSite";
import {
  buildDynamicPayboxUrl,
  copyText,
  getPayboxPaymentDetails,
  openPayboxLink,
} from "@/lib/paymentLinks";
import { useToast } from "@/components/ui/use-toast";

const PHONE = "0549000301";
const BIT_LOGO =
  "https://upload.wikimedia.org/wikipedia/he/thumb/b/b5/Bit_by_Bank_Hapoalim_logo.svg/512px-Bit_by_Bank_Hapoalim_logo.svg.png";
const PAYBOX_LOGO =
  "https://play-lh.googleusercontent.com/EHQ_r2MYpH1N6FWjQVMvwMfHVWRgJq-HNnfakm4fKlJp0x8Fjbw5RvX7jAcFU3qS5Q=w240-h480-rw";

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

  const handleCopyPaybox = async () => {
    try {
      await copyText(payboxDetails.url || payboxUrl);
      toast({ title: "קישור PayBox הועתק" });
    } catch {
      toast({
        title: "לא ניתן להעתיק",
        description: "העתיקו ידנית מהמסך.",
        variant: "destructive",
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="py-8 px-2"
      dir="rtl"
    >
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <CreditCard className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">תשלום מקדמה</h2>
        <p className="text-muted-foreground">לפני אישור התור, יש לשלם מקדמה</p>
      </div>

      <div className="bg-muted/50 rounded-xl p-5 mb-6 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">טיפול:</span>
          <span className="font-medium">{treatment?.name}</span>
        </div>
        <div className="space-y-2">
          <span className="text-muted-foreground">תורים:</span>
          <div className="space-y-1">
            {appointments.map((appointment) => (
              <div key={`${appointment.date}-${appointment.time}`} className="flex justify-between">
                <span className="font-medium">{format(new Date(appointment.date + "T00:00:00"), "dd/MM/yyyy")}</span>
                <span className="font-medium">{appointment.time}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">כמות תורים:</span>
          <span className="font-medium">{appointments.length}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-2 mt-2">
          <span className="text-muted-foreground">לתשלום:</span>
          <span className="font-bold text-lg">₪{totalPrice}</span>
        </div>
      </div>

      <p className="mb-3 text-center text-sm font-semibold text-foreground">אמצעי תשלום</p>
      <div className="mb-4 grid grid-cols-2 gap-3">
        {bitQrImage ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleBitClick}
              className={`inline-flex w-full flex-col items-center gap-0.5 rounded-xl border-2 bg-white p-2 leading-none transition-all active:scale-[0.98] ${
                bitGuideOpen ? "border-[#0079C1] shadow-sm" : "border-border hover:border-[#0079C1]"
              }`}
              aria-label={`תשלום ₪${totalPrice} בביט`}
              aria-expanded={bitGuideOpen}
            >
              <img
                src={BIT_LOGO}
                alt=""
                className="block h-10 w-10 object-contain"
                width={40}
                height={40}
              />
              <span className="px-0.5 text-[11px] font-semibold text-[#0079C1]">שלם בביט</span>
            </button>
          </div>
        ) : (
          <a href={bitUrl} target="_blank" rel="noopener noreferrer">
            <button
              type="button"
              className="w-full py-3 px-4 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#0079C1" }}
            >
              <img src={BIT_LOGO} alt="Bit" className="h-5 object-contain" />
              שלם בביט
            </button>
          </a>
        )}

        {payboxLink ? (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleOpenPaybox}
              className="w-full py-3 px-4 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#7B3FBE" }}
              aria-label="תשלום ב-PayBox"
            >
              <img src={PAYBOX_LOGO} alt="" className="h-5 w-5 object-contain rounded" />
              שלם ב-Paybox
            </button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 w-full text-xs"
              onClick={handleCopyPaybox}
            >
              <Copy className="h-3.5 w-3.5" />
              העתק קישור
            </Button>
          </div>
        ) : (
          <a href={payboxUrl} target="_blank" rel="noopener noreferrer">
            <button
              type="button"
              className="w-full py-3 px-4 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#7B3FBE" }}
            >
              <img src={PAYBOX_LOGO} alt="Paybox" className="h-5 w-5 object-contain rounded" />
              שלם ב-Paybox
            </button>
          </a>
        )}
      </div>

      {bitQrImage && bitGuideOpen && (
        <div className="mb-6 rounded-xl border-2 border-[#0079C1]/30 bg-[#0079C1]/5 p-4 text-sm">
          <p className="mb-3 text-center font-semibold text-[#0079C1]">
            סרקו את הברקוד לתשלום בביט על סך ₪{totalPrice.toLocaleString("he-IL")}
          </p>
          <div className="mx-auto max-w-xs overflow-hidden rounded-xl border border-[#0079C1]/30 bg-white p-2">
            <img
              src={bitQrImage}
              alt="ברקוד לתשלום בביט"
              className="mx-auto block h-auto w-full object-contain"
            />
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            פתחו ביט בטלפון וסרקו את הקוד. לאחר התשלום לחצו "שילמתי — אשר את התור".
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center mb-8">
        {bitQrImage
          ? "לחצו על ביט לקבלת הוראות תשלום וסריקת הברקוד"
          : "הכפתורים יפתחו את האפליקציה במכשירכם"}
      </p>

      <Button
        onClick={onConfirm}
        disabled={isSubmitting}
        size="lg"
        className="w-full rounded-xl text-lg py-6 gap-2 mb-3"
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
        className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-2"
      >
        <ArrowRight className="w-4 h-4" />
        חזרה לטופס
      </button>
    </motion.div>
  );
}
