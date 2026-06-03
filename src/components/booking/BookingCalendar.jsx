import React, { useMemo } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isBefore,
  startOfDay,
  isSameDay,
} from "date-fns";
import { he } from "date-fns/locale";
import {
  clinicCalendarCard,
  clinicCalendarNavBtn,
  clinicCalendarDayBase,
  clinicCalendarDayAvailable,
  clinicCalendarDaySelected,
  clinicCalendarDayDisabled,
  clinicCalendarDayToday,
  clinicCalendarDayHeader,
  clinicCalendarFooter,
  clinicCalendarSlotCount,
  clinicTextHeading,
  clinicTextMuted,
  clinicTextPrimary,
} from "@/lib/clinicUi";

const DAY_NAMES = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

export default function BookingCalendar({
  viewMonth,
  onViewMonthChange,
  selectedDate,
  onDateSelect,
  slotCountByDate = {},
  isDateAvailable,
  selectedDaySlotCount = 0,
}) {
  const today = startOfDay(new Date());

  const daysInMonth = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(viewMonth), end: endOfMonth(viewMonth) }),
    [viewMonth]
  );

  const firstDayOffset = useMemo(
    () => startOfMonth(viewMonth).getDay(),
    [viewMonth]
  );

  return (
    <div className="space-y-3">
      <div className={clinicCalendarCard}>
        <div className="mb-5 flex items-center justify-between" dir="rtl">
          <button
            type="button"
            onClick={() => onViewMonthChange(subMonths(viewMonth, 1))}
            className={clinicCalendarNavBtn}
            aria-label="חודש קודם"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className={`text-base font-bold ${clinicTextHeading}`}>
            {format(viewMonth, "MMMM yyyy", { locale: he })}
          </span>
          <button
            type="button"
            onClick={() => onViewMonthChange(addMonths(viewMonth, 1))}
            className={clinicCalendarNavBtn}
            aria-label="חודש הבא"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 mb-2">
          {DAY_NAMES.map((d) => (
            <div key={d} className={clinicCalendarDayHeader}>
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: firstDayOffset }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {daysInMonth.map((date) => {
            const available = isDateAvailable(date);
            const selected = selectedDate && isSameDay(date, selectedDate);
            const isPast = isBefore(date, today);
            const isToday = isSameDay(date, today);
            const dateStr = format(date, "yyyy-MM-dd");
            const slotCount = slotCountByDate[dateStr] ?? 0;

            return (
              <button
                key={date.toISOString()}
                type="button"
                onClick={() => onDateSelect(date)}
                disabled={!available}
                aria-selected={selected}
                className={`${clinicCalendarDayBase}
                  ${selected ? clinicCalendarDaySelected : ""}
                  ${!selected && available ? clinicCalendarDayAvailable : ""}
                  ${!selected && isToday && available ? clinicCalendarDayToday : ""}
                  ${isPast || !available ? clinicCalendarDayDisabled : ""}
                `}
              >
                <span className="leading-none">{date.getDate()}</span>
                {available && slotCount > 0 && (
                  <span
                    className={`${clinicCalendarSlotCount} ${
                      selected ? "text-white/90" : clinicTextMuted
                    }`}
                  >
                    <span className={selected ? "text-white/80" : clinicTextPrimary}>•</span>
                    {slotCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && selectedDaySlotCount > 0 && (
        <p className={clinicCalendarFooter}>
          {selectedDaySlotCount} תורים פנויים ביום זה
        </p>
      )}
    </div>
  );
}
