import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, CreditCard, CheckCircle2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

const PHONE = "0549000301";

export default function PaymentStep({ formData, treatment, onConfirm, onBack, isSubmitting }) {
  const price = treatment?.price ?? 250;

  const bitUrl = `https://www.bitpay.co.il/app/pay?phone=${PHONE}&amount=${price}`;
  const payboxUrl = `https://payboxapp.page.link/?link=https://payboxapp.com/pay?to%3D${PHONE}%26amount%3D${price}&apn=com.paybox.www&isi=1163995014&ibi=com.paybox.app`;

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

      {/* Appointment summary */}
      <div className="bg-muted/50 rounded-xl p-5 mb-6 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">טיפול:</span>
          <span className="font-medium">{treatment?.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">תאריך:</span>
          <span className="font-medium">{format(new Date(formData.date + "T00:00:00"), "dd/MM/yyyy")}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">שעה:</span>
          <span className="font-medium">{formData.time}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-2 mt-2">
          <span className="text-muted-foreground">לתשלום:</span>
          <span className="font-bold text-lg">₪{price}</span>
        </div>
      </div>

      {/* Payment buttons */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <a href={bitUrl} target="_blank" rel="noopener noreferrer">
          <button className="w-full py-3 px-4 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90" style={{ backgroundColor: "#0079C1" }}>
            <img src="https://upload.wikimedia.org/wikipedia/he/thumb/b/b5/Bit_by_Bank_Hapoalim_logo.svg/512px-Bit_by_Bank_Hapoalim_logo.svg.png" alt="Bit" className="h-5 object-contain" />
            שלם בביט
          </button>
        </a>
        <a href={payboxUrl} target="_blank" rel="noopener noreferrer">
          <button className="w-full py-3 px-4 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90" style={{ backgroundColor: "#7B3FBE" }}>
            <img src="https://play-lh.googleusercontent.com/EHQ_r2MYpH1N6FWjQVMvwMfHVWRgJq-HNnfakm4fKlJp0x8Fjbw5RvX7jAcFU3qS5Q=w240-h480-rw" alt="Paybox" className="h-5 w-5 object-contain rounded" />
            שלם ב-Paybox
          </button>
        </a>
      </div>
      <p className="text-xs text-muted-foreground text-center mb-8">הכפתורים יפתחו את האפליקציה במכשירכם</p>

      {/* Confirm button */}
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
        onClick={onBack}
        className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-2"
      >
        <ArrowRight className="w-4 h-4" />
        חזרה לטופס
      </button>
    </motion.div>
  );
}