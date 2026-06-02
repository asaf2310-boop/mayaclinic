import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Home, CalendarPlus } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { getClinicSite } from "@/lib/clinicSite";

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
      className={`text-center py-16 px-6 ${clinicSite ? "rounded-3xl border border-white/70 bg-white/75 shadow-[0_8px_30px_rgba(0,0,0,0.04)] backdrop-blur-xl" : ""}`}
    >
      <div
        className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 ${
          clinicSite ? "bg-gradient-to-br from-[#edf3ee] to-[#e6ece7]" : "bg-primary/10"
        }`}
      >
        <CheckCircle2 className={`w-10 h-10 ${clinicSite ? "text-[#416d5c]" : "text-primary"}`} />
      </div>

      <h2 className={`text-3xl font-bold mb-3 ${clinicSite ? "text-[#1a2e28]" : "text-foreground"}`}>
        התורים נקבעו בהצלחה!
      </h2>
      <p className={`text-lg mb-8 ${clinicSite ? "text-[#4a6b5f]" : "text-muted-foreground"}`}>
        נשלח אליכם אישור בקרוב
      </p>

      <div
        className={`rounded-2xl p-6 max-w-sm mx-auto mb-6 text-right ${
          clinicSite
            ? "border border-white/70 bg-white/75 shadow-[0_4px_12px_rgba(0,0,0,0.02)] backdrop-blur-xl"
            : "bg-muted/50"
        }`}
        dir="rtl"
      >
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">טיפול:</span>
            <span className="font-medium text-foreground">{appointment.treatment_name || appointments[0]?.treatment_name}</span>
          </div>
          <div className="space-y-2">
            <span className="text-muted-foreground">תורים:</span>
            <div className="space-y-1">
              {appointments.map((item) => (
                <div key={item.id || `${item.date}-${item.time}`} className="flex justify-between">
                  <span className="font-medium text-foreground">{format(new Date(item.date + "T00:00:00"), "dd/MM/yyyy")}</span>
                  <span className="font-medium text-foreground">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">כמות תורים:</span>
            <span className="font-medium text-foreground">{appointments.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">סטטוס:</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-3 mt-3">
            <span className="text-muted-foreground">לתשלום:</span>
            <span className="font-bold text-foreground text-base">₪{price}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link to="/">
          <Button
            variant="outline"
            className={`gap-2 ${
              clinicSite
                ? "rounded-2xl border-[#bcd0c4] bg-white/40 backdrop-blur-md hover:bg-white/60"
                : "rounded-xl"
            }`}
          >
            <Home className="w-4 h-4" />
            חזרה לעמוד הבית
          </Button>
        </Link>
        <Button
          onClick={onReset}
          className={`gap-2 ${
            clinicSite
              ? "rounded-2xl bg-gradient-to-r from-[#416d5c] to-[#2f5245] text-white shadow-[0_10px_25px_rgba(65,109,92,0.2)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_12px_30px_rgba(65,109,92,0.3)] active:scale-[0.98]"
              : "rounded-xl"
          }`}
        >
          <CalendarPlus className="w-4 h-4" />
          קביעת תור נוסף
        </Button>
      </div>
    </motion.div>
  );
}