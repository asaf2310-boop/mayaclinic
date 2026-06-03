import React from "react";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  clinicTextHeading,
  clinicTextMuted,
  clinicTimeSlotBtn,
  clinicTimeSlotBtnSelected,
} from "@/lib/clinicUi";

export default function TimeSlotSelector({
  slots = [],
  selectedSlot,
  onSelect,
  isLoading = false,
}) {
  return (
    <div className="space-y-3">
      <Label className={`text-base font-bold ${clinicTextHeading}`}>בחרו שעה *</Label>

      {isLoading ? (
        <div className={`flex items-center gap-2 text-sm ${clinicTextMuted}`}>
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
              aria-pressed={selectedSlot === slot}
              className={
                selectedSlot === slot ? clinicTimeSlotBtnSelected : clinicTimeSlotBtn
              }
            >
              {slot}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[#B85C5C]">אין שעות פנויות בתאריך זה, בחרו תאריך אחר.</p>
      )}
    </div>
  );
}
