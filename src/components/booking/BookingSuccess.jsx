import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Home, CalendarPlus } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { getClinicSite } from "@/lib/clinicSite";
import {
  clinicGlassCard,
  clinicGlassPanel,
  clinicIconSurface,
  clinicOutlineBtn,
  clinicPrimaryBtn,
  clinicTextHeading,
  clinicTextMuted,
  clinicTextPrimary,
} from "@/lib/clinicUi";

const DEFAULT_PRICE = 250;

const STATUS_MAP = {
  pending: { label: "ממתין לאישור", color: "text-yellow-600 bg-yellow-50" },
  confirmed: { label: "מאושר", color: "text-green-600 bg-green-50" },
  cancelled: { label: "בוטל", color: "text-red-600 bg-red-50" },
  completed: { label: "הושלם", color: "text-blue-600 bg-blue-50" },
};

export default function BookingSuccess({ appointment, onReset }) {
  const clinicSite = getClinicSite();
  const appointments = appointment.appointments || [appointment];
  const price = (appointment.treatment_price ?? DEFAULT_PRICE) * appointments.length;
  const status = STATUS_MAP[appointments[0]?.status] || STATUS_MAP.pending;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`px-3 py-10 text-center sm:px-6 sm:py-16 ${clinicSite ? clinicGlassPanel : ""}`}
    >
      <div
        className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl sm:mb-6 sm:h-20 sm:w-20 ${
          clinicSite ? clinicIconSurface : "bg-primary/10"
        }`}
      >
        <CheckCircle2 className={`h-8 w-8 sm:h-10 sm:w-10 ${clinicSite ? clinicTextPrimary : "text-primary"}`} />
      </div>

      <h2 className={`mb-2 text-2xl font-bold sm:mb-3 sm:text-3xl ${clinicSite ? clinicTextHeading : "text-foreground"}`}>
        התורים נקבעו בהצלחה!
      </h2>
      <p className={`mb-6 text-base sm:mb-8 sm:text-lg ${clinicSite ? clinicTextMuted : "text-muted-foreground"}`}>
        נשלח אליכם אישור בקרוב
      </p>

      <div
        className={`mx-auto mb-6 max-w-sm rounded-2xl p-6 text-right ${
          clinicSite ? clinicGlassCard : "bg-muted/50"
        }`}
        dir="rtl"
      >
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className={clinicSite ? clinicTextMuted : "text-muted-foreground"}>טיפול:</span>
            <span className={`font-medium ${clinicSite ? clinicTextHeading : "text-foreground"}`}>
              {appointment.treatment_name || appointments[0]?.treatment_name}
            </span>
          </div>
          <div className="space-y-2">
            <span className={clinicSite ? clinicTextMuted : "text-muted-foreground"}>תורים:</span>
            <div className="space-y-1">
              {appointments.map((item) => (
                <div key={item.id || `${item.date}-${item.time}`} className="flex justify-between">
                  <span className={`font-medium ${clinicSite ? clinicTextHeading : "text-foreground"}`}>
                    {format(new Date(item.date + "T00:00:00"), "dd/MM/yyyy")}
                  </span>
                  <span className={`font-medium ${clinicSite ? clinicTextHeading : "text-foreground"}`}>{item.time}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-between">
            <span className={clinicSite ? clinicTextMuted : "text-muted-foreground"}>כמות תורים:</span>
            <span className={`font-medium ${clinicSite ? clinicTextHeading : "text-foreground"}`}>{appointments.length}</span>
          </div>
          <div className="flex justify-between">
            <span className={clinicSite ? clinicTextMuted : "text-muted-foreground"}>סטטוס:</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>{status.label}</span>
          </div>
          <div
            className={`mt-3 flex justify-between border-t pt-3 ${
              clinicSite ? "border-[#E8ECE8]" : "border-border"
            }`}
          >
            <span className={clinicSite ? clinicTextMuted : "text-muted-foreground"}>לתשלום:</span>
            <span className={`text-base font-bold ${clinicSite ? clinicTextPrimary : "text-foreground"}`}>₪{price}</span>
          </div>
        </div>
      </div>

      <div className="flex w-full flex-col justify-center gap-3 sm:flex-row">
        <Button
          asChild
          variant="outline"
          className={`w-full gap-2 sm:w-auto ${clinicSite ? clinicOutlineBtn : "rounded-xl"}`}
        >
          <Link to="/">
            <Home className="w-4 h-4" />
            חזרה לעמוד הבית
          </Link>
        </Button>
        <Button
          asChild
          className={`w-full gap-2 sm:w-auto ${clinicSite ? clinicPrimaryBtn : "rounded-xl"}`}
        >
          <Link
            to="/"
            onClick={() => onReset?.()}
          >
            <CalendarPlus className="w-4 h-4" />
            קביעת תור נוסף
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}