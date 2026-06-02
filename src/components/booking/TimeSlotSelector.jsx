import React from "react";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { clinicTimeSlotBtn, clinicTimeSlotBtnSelected } from "@/lib/clinicUi";

const DEFAULT_HOURS_HINT =
  "שעות פעילות: א'-ה' 08:30-12:00, 16:00-19:00. ימי ו' 10:00-12:00 לחיילים בלבד.";

export default function TimeSlotSelector({
  slots = [],
  selectedSlot,
  onSelect,
  isLoading = false,
  durationMinutes,
  hoursHint = DEFAULT_HOURS_HINT,
}) {
  const durationText = durationMinutes
    ? ` משך תור ${durationMinutes} דקות.`
    : "";

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-base font-bold text-[#1e2f27]">בחרו שעה *</Label>
        <p className="mt-1.5 text-sm leading-relaxed text-[#8a958f]">
          {hoursHint}
          {durationText}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-[#8a958f]">
          <Loader2 className="h-4 w-4 animate-spin" />
          בודק שעות זמינות...
        </div>
      ) : slots.length > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          {slots.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => onSelect(slot)}
              className={`${clinicTimeSlotBtn} ${
                selectedSlot === slot ? clinicTimeSlotBtnSelected : ""
              }`}
            >
              {slot}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-destructive">אין שעות פנויות בתאריך זה, בחרו תאריך אחר.</p>
      )}
    </div>
  );
}
