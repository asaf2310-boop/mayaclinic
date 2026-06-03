import React, { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarPlus, CalendarCheck, Loader2 } from "lucide-react";
import { format, isBefore, startOfDay } from "date-fns";
import { getClinicSite } from "@/lib/clinicSite";
import {
  clinicCheckboxPanel,
  clinicFormHint,
  clinicFormInput,
  clinicFormLabel,
  clinicPrimaryBtn,
  clinicSelectionBanner,
  clinicTextPrimary,
} from "@/lib/clinicUi";
import BookingCalendar from "@/components/booking/BookingCalendar";
import TimeSlotSelector from "@/components/booking/TimeSlotSelector";
import {
  countAvailableSlotsByDate,
  filterAvailableSlots,
} from "@/lib/bookingSlots";

export default function BookingForm({ selectedTreatment, onSubmit, isSubmitting }) {
  const clinicSite = getClinicSite();
  const [form, setForm] = useState({
    patient_name: "",
    patient_phone: "",
    patient_email: "",
    date: "",
    time: "",
    notes: "",
    marketing_consent: false,
  });

  const { data: availabilityRecords = [] } = useQuery({
    queryKey: ["availability"],
    queryFn: () => base44.entities.Availability.list(),
  });

  const { data: allAppointments = [] } = useQuery({
    queryKey: ["appointments-for-booking"],
    queryFn: () => base44.entities.Appointment.list(),
  });

  const { data: existingAppointments = [], isFetching: isFetchingAppointments } = useQuery({
    queryKey: ["appointments-for-date", form.date],
    queryFn: () => base44.entities.Appointment.filter({ date: form.date }),
    enabled: !!form.date,
  });

  const bookingDurationMinutes = selectedTreatment?.duration_minutes ?? 60;

  const appointmentsByDate = useMemo(() => {
    const byDate = {};
    for (const appointment of allAppointments) {
      if (!appointment.date) continue;
      if (!byDate[appointment.date]) byDate[appointment.date] = [];
      byDate[appointment.date].push(appointment);
    }
    return byDate;
  }, [allAppointments]);

  const activeDates = useMemo(() => {
    return new Set(
      availabilityRecords.filter((r) => r.is_active && r.slots?.length > 0).map((r) => r.date)
    );
  }, [availabilityRecords]);

  const slotCountByDate = useMemo(
    () =>
      countAvailableSlotsByDate(availabilityRecords, appointmentsByDate, {
        bookingDurationMinutes,
      }),
    [availabilityRecords, appointmentsByDate, bookingDurationMinutes]
  );

  const availableSlots = useMemo(() => {
    if (!form.date) return [];
    const rec = availabilityRecords.find((r) => r.date === form.date && r.is_active);
    if (!rec) return [];
    return filterAvailableSlots(rec.slots, existingAppointments, {
      bookingDurationMinutes,
    });
  }, [form.date, availabilityRecords, existingAppointments, bookingDurationMinutes]);

  const handleChange = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "date") next.time = "";
      return next;
    });
  };

  useEffect(() => {
    if (form.time && !isFetchingAppointments && !availableSlots.includes(form.time)) {
      handleChange("time", "");
    }
  }, [form.time, isFetchingAppointments, availableSlots]);

  const hasCompleteSelection = Boolean(form.date && form.time);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedTreatment || !form.patient_name || !form.patient_phone || !hasCompleteSelection) return;
    onSubmit({
      patient_name: form.patient_name,
      patient_phone: form.patient_phone,
      patient_email: form.patient_email,
      notes: form.notes,
      marketing_consent: form.marketing_consent,
      treatment_id: selectedTreatment.id,
      treatment_name: selectedTreatment.name,
      appointments: [{ date: form.date, time: form.time }],
    });
  };

  const today = startOfDay(new Date());
  const [viewMonth, setViewMonth] = useState(new Date());

  const isDateAvailable = (date) => {
    if (isBefore(date, today)) return false;
    const dateStr = format(date, "yyyy-MM-dd");
    return activeDates.has(dateStr);
  };

  const handleDateSelect = (date) => {
    if (!isDateAvailable(date)) return;
    handleChange("date", format(date, "yyyy-MM-dd"));
  };

  const selectedDate = form.date ? new Date(form.date + "T00:00:00") : null;
  const formattedSelectedDate = form.date
    ? format(new Date(form.date + "T00:00:00"), "dd/MM/yyyy")
    : null;

  const labelClass = clinicSite ? clinicFormLabel : undefined;
  const inputClass = clinicSite ? clinicFormInput : undefined;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name" className={labelClass}>שם מלא *</Label>
          <Input
            id="name"
            placeholder="הכניסו את שמכם"
            value={form.patient_name}
            onChange={(e) => handleChange("patient_name", e.target.value)}
            required
            className={inputClass}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone" className={labelClass}>טלפון *</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="050-0000000"
            value={form.patient_phone}
            onChange={(e) => handleChange("patient_phone", e.target.value)}
            required
            dir="ltr"
            className={inputClass ? `${inputClass} text-left` : "text-left"}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email" className={labelClass}>אימייל</Label>
        <Input
          id="email"
          type="email"
          placeholder="your@email.com"
          value={form.patient_email}
          onChange={(e) => handleChange("patient_email", e.target.value)}
          dir="ltr"
          className={inputClass ? `${inputClass} text-left` : "text-left"}
        />
      </div>

      <div className="space-y-2">
        <Label className={labelClass}>בחרו תאריך *</Label>
        <BookingCalendar
          viewMonth={viewMonth}
          onViewMonthChange={setViewMonth}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          slotCountByDate={slotCountByDate}
          isDateAvailable={isDateAvailable}
          selectedDaySlotCount={form.date ? availableSlots.length : 0}
        />
      </div>

      {form.date && (
        <TimeSlotSelector
          slots={availableSlots}
          selectedSlot={form.time}
          onSelect={(slot) => handleChange("time", slot)}
          isLoading={isFetchingAppointments}
          durationMinutes={selectedTreatment?.duration_minutes}
          hoursHint={clinicSite?.bookingHoursHint}
        />
      )}

      {form.date && (
        <div
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
            hasCompleteSelection
              ? clinicSelectionBanner
              : clinicSite
                ? "border-[#E8ECE8] bg-[#FAFBFA] text-[#6B746F]"
                : "border-border bg-muted/30 text-muted-foreground"
          }`}
          role="status"
          aria-live="polite"
        >
          <CalendarCheck
            className={`h-5 w-5 shrink-0 ${hasCompleteSelection ? clinicTextPrimary : "text-muted-foreground"}`}
            aria-hidden
          />
          <p className="font-medium">
            {hasCompleteSelection ? (
              <>נבחר: {formattedSelectedDate} בשעה {form.time}</>
            ) : (
              <>נבחר תאריך: {formattedSelectedDate} — בחרו שעה מהרשימה למעלה</>
            )}
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes" className={labelClass}>הערות נוספות</Label>
        <Textarea
          id="notes"
          placeholder="האם יש משהו שחשוב שנדע?"
          value={form.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
          rows={3}
          className={inputClass}
        />
      </div>

      <label
        className={
          clinicSite
            ? clinicCheckboxPanel
            : "flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-4 text-sm leading-6"
        }
      >
        <Checkbox
          checked={form.marketing_consent}
          onCheckedChange={(checked) => handleChange("marketing_consent", Boolean(checked))}
          className="mt-1 border-[#DDE4DD] data-[state=checked]:border-[#5D7F6D] data-[state=checked]:bg-[#5D7F6D]"
        />
        <span className={clinicSite ? undefined : "text-muted-foreground"}>
          אני מאשר/ת קבלת עדכונים, מבצעים ותזכורות שיווקיות ממאיה קליניק.
        </span>
      </label>

      {selectedTreatment && !hasCompleteSelection && (
        <p className={clinicSite ? clinicFormHint : "text-center text-sm text-amber-600"}>
          יש לבחור תאריך ושעה לתור
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        className={`w-full gap-2 text-lg ${clinicSite ? clinicPrimaryBtn : "rounded-xl py-6"}`}
        disabled={
          !selectedTreatment ||
          !form.patient_name ||
          !form.patient_phone ||
          !hasCompleteSelection ||
          isSubmitting
        }
      >
        {isSubmitting ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <CalendarPlus className="w-5 h-5" />
        )}
        {isSubmitting ? "שולח..." : "אישור הזמנה"}
      </Button>
    </form>
  );
}
