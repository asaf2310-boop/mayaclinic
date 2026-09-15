import React, { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { getClinicSite } from "@/lib/clinicSite";
import {
  clinicTextHeading,
  clinicTextMuted,
  clinicTextPrimary,
} from "@/lib/clinicUi";
import { checkMeridianTreatmentId } from "@/lib/meridianBooking";

/**
 * First step of Meridian booking: verify treatment ID via IMAP before slots.
 */
export default function MeridianVerifyStep({ onVerified }) {
  const clinicSite = getClinicSite();
  const [treatmentId, setTreatmentId] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");

  const mutedClass = clinicSite ? clinicTextMuted : "text-muted-foreground";
  const valueClass = clinicSite ? clinicTextHeading : "text-foreground";
  const primaryClass = clinicSite ? clinicTextPrimary : "text-primary";
  const ctaClass = clinicSite
    ? "rounded-2xl bg-[#5D7F6D] text-white shadow-[0_8px_24px_rgba(93,127,109,0.22)] hover:bg-[#4F6F5F]"
    : "rounded-xl bg-primary text-primary-foreground";

  const handleSubmit = async (event) => {
    event?.preventDefault?.();
    const digits = String(treatmentId || "").replace(/\D/g, "");
    if (digits.length < 6) {
      setError("נא להזין מזהה טיפול תקין ממרידיאן");
      return;
    }

    setIsVerifying(true);
    setError("");
    try {
      const result = await checkMeridianTreatmentId(digits);
      onVerified?.({
        treatmentId: result.treatmentId || digits,
        verificationToken: result.verificationToken || "",
      });
    } catch (err) {
      setError(err?.message || "לא ניתן לאשר את המזהה. בדקו את המספר ונסו שוב.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative w-full max-w-full overflow-hidden ${
        clinicSite
          ? "rounded-2xl border border-[#D5E0D8]/80 bg-gradient-to-b from-[#F3F7F4]/95 via-[#EAF1EC]/90 to-[#F7F8F6]/95 p-4 shadow-[0_12px_36px_rgba(93,127,109,0.1)] backdrop-blur-[18px] sm:rounded-[28px] sm:p-6 md:p-8"
          : "py-4"
      }`}
      dir="rtl"
    >
      <div className="relative mb-5 text-center sm:mb-7">
        <div
          className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl sm:mb-4 sm:h-16 sm:w-16 ${
            clinicSite
              ? "border border-[#D5E0D8] bg-[#F0F4F1]/90 shadow-[0_8px_24px_rgba(93,127,109,0.1)]"
              : "bg-primary/10"
          }`}
        >
          <ShieldCheck className={`h-6 w-6 sm:h-8 sm:w-8 ${primaryClass}`} />
        </div>
        <h2
          className={`mb-1.5 text-xl font-bold tracking-tight sm:mb-2 sm:text-2xl ${
            clinicSite ? clinicTextHeading : "text-foreground"
          }`}
        >
          אימות מזהה מרידיאן
        </h2>
        <p className={`mx-auto max-w-sm text-sm leading-relaxed sm:text-base ${mutedClass}`}>
          הזינו את מזהה הטיפול מאתר מרידיאן לפני בחירת מועד
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-2 text-right">
          <span className={`text-sm font-medium ${valueClass}`}>מזהה טיפול מאתר מרידיאן</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={treatmentId}
            onChange={(event) => {
              setTreatmentId(event.target.value.replace(/[^\d]/g, ""));
              if (error) setError("");
            }}
            className={`w-full rounded-2xl border px-4 py-3 text-base tabular-nums outline-none transition focus:ring-2 ${
              clinicSite
                ? "border-[#D5E0D8] bg-white/90 text-[#2F3E35] placeholder:text-[#8A9A90] focus:border-[#5D7F6D] focus:ring-[#5D7F6D]/25"
                : "border-border bg-background focus:ring-primary/30"
            }`}
            disabled={isVerifying}
            aria-label="מזהה טיפול מאתר מרידיאן"
            dir="ltr"
          />
        </label>

        {error ? <p className="text-center text-sm text-[#9B2C2C]">{error}</p> : null}

        <button
          type="submit"
          disabled={isVerifying || String(treatmentId).replace(/\D/g, "").length < 6}
          className={`flex w-full items-center justify-center gap-2.5 px-4 py-3.5 text-[15px] font-semibold transition-transform active:scale-[0.99] disabled:opacity-60 sm:gap-3 sm:px-6 sm:py-4 sm:text-base ${ctaClass}`}
          aria-label="אימות מזהה והמשך"
        >
          {isVerifying ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
          ) : (
            <ShieldCheck className="h-5 w-5 shrink-0" />
          )}
          <span className="leading-none">
            {isVerifying ? "מאמתים…" : "אימות והמשך לקביעת תור"}
          </span>
        </button>
      </form>
    </motion.div>
  );
}
