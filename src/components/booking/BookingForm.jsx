import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CalendarPlus, Loader2, ChevronRight, ChevronLeft } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isBefore, startOfDay, isSameDay } from "date-fns";
import { he } from "date-fns/locale";

export default function BookingForm({ selectedTreatment, onSubmit, isSubmitting }) {
  const [form, setForm] = useState({
    patient_name: "",
    patient_phone: "",
    patient_email: "",
    date: "",
    time: "",
    notes: "",
  });

  const { data: availabilityRecords = [] } = useQuery({
    queryKey: ["availability"],
    queryFn: () => base44.entities.Availability.list(),
  });

  const { data: existingAppointments = [] } = useQuery({
    queryKey: ["appointments-for-date", form.date],
    queryFn: () => base44.entities.Appointment.filter({ date: form.date }),
    enabled: !!form.date,
  });

  // Dates that have availability configured (as a Set of dateStrings)
  const activeDates = useMemo(() => {
    return new Set(
      availabilityRecords.filter((r) => r.is_active && r.slots?.length > 0).map((r) => r.date)
    );
  }, [availabilityRecords]);

  // Available slots for the chosen date (minus already booked)
  const availableSlots = useMemo(() => {
    if (!form.date) return [];
    const rec = availabilityRecords.find((r) => r.date === form.date && r.is_active);
    if (!rec) return [];
    const booked = new Set(
      existingAppointments
        .filter((a) => a.status !== "cancelled")
        .map((a) => a.time)
    );
    return (rec.slots || []).filter((s) => !booked.has(s));
  }, [form.date, availabilityRecords, existingAppointments]);

  const handleChange = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "date") next.time = ""; // reset time on date change
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedTreatment || !form.patient_name || !form.patient_phone || !form.date || !form.time) return;
    onSubmit({
      ...form,
      treatment_id: selectedTreatment.id,
      treatment_name: selectedTreatment.name,
    });
  };

  const today = startOfDay(new Date());
  const [viewMonth, setViewMonth] = useState(new Date());

  const daysInMonth = useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(viewMonth), end: endOfMonth(viewMonth) });
  }, [viewMonth]);

  const firstDayOffset = useMemo(() => {
    // LTR grid starting Sunday (0). Column 0=Sun, 1=Mon, ... 6=Sat
    return startOfMonth(viewMonth).getDay();
  }, [viewMonth]);

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

  // LTR grid: leftmost = Sunday, rightmost = Saturday
  const DAY_NAMES = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">שם מלא *</Label>
          <Input
            id="name"
            placeholder="הכניסו את שמכם"
            value={form.patient_name}
            onChange={(e) => handleChange("patient_name", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">טלפון *</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="050-0000000"
            value={form.patient_phone}
            onChange={(e) => handleChange("patient_phone", e.target.value)}
            required
            dir="ltr"
            className="text-left"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">אימייל</Label>
        <Input
          id="email"
          type="email"
          placeholder="your@email.com"
          value={form.patient_email}
          onChange={(e) => handleChange("patient_email", e.target.value)}
          dir="ltr"
          className="text-left"
        />
      </div>

      {/* Date picker */}
      <div className="space-y-2">
        <Label>תאריך *</Label>
        <div className="border border-border rounded-xl p-4 bg-background">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4" dir="rtl">
            <button type="button" onClick={() => setViewMonth(subMonths(viewMonth, 1))} className="p-1 rounded-lg hover:bg-muted">
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="font-medium text-sm">{format(viewMonth, "MMMM yyyy", { locale: he })}</span>
            <button type="button" onClick={() => setViewMonth(addMonths(viewMonth, 1))} className="p-1 rounded-lg hover:bg-muted">
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
          {/* Day names */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_NAMES.map((d) => (
              <div key={d} className="text-center text-xs text-muted-foreground py-1">{d}</div>
            ))}
          </div>
          {/* Days grid */}
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`empty-${i}`} />)}
            {daysInMonth.map((date) => {
              const available = isDateAvailable(date);
              const selected = selectedDate && isSameDay(date, selectedDate);
              const isPast = isBefore(date, today);
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => handleDateSelect(date)}
                  disabled={!available}
                  className={`aspect-square flex items-center justify-center rounded-lg text-sm m-0.5 transition-all font-medium
                    ${selected ? "bg-primary text-primary-foreground" : ""}
                    ${!selected && available ? "hover:bg-accent text-foreground" : ""}
                    ${isPast || !available ? "text-muted-foreground/40 cursor-not-allowed" : ""}
                  `}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Time slots */}
      {form.date && (
        <div className="space-y-2">
          <Label>שעה *</Label>
          {availableSlots.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {availableSlots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => handleChange("time", slot)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                    form.time === slot
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:border-primary/40"
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
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">הערות נוספות</Label>
        <Textarea
          id="notes"
          placeholder="האם יש משהו שחשוב שנדע?"
          value={form.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
          rows={3}
        />
      </div>

      {selectedTreatment && (!form.date || !form.time) && (
        <p className="text-sm text-amber-600 text-center">יש לבחור תאריך ושעה</p>
      )}
      <Button
        type="submit"
        size="lg"
        className="w-full rounded-xl text-lg py-6 gap-2"
        disabled={!selectedTreatment || !form.patient_name || !form.patient_phone || !form.date || !form.time || isSubmitting}
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