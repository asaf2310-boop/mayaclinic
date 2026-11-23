import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import {
  bookingEmailErrorMessage,
  validateBookingEmail,
} from "@/lib/bookingEmailValidation";
import { createAdminAppointment } from "@/lib/adminBooking";
import { filterAvailableSlots } from "@/lib/bookingSlots";
import { normalizeTimeInput } from "@/components/admin/appointmentTableShared";

const EMPTY_FORM = {
  patient_name: "",
  patient_phone: "",
  patient_email: "",
  treatment_id: "",
  treatment_name: "",
  treatment_price: "",
  duration_minutes: 60,
  date: "",
  time: "",
  notes: "",
  paid: false,
  marketing_consent: false,
};

/**
 * Manual admin create — mirrors customer booking side-effects on the server.
 */
export default function AppointmentCreateDialog({
  open,
  onOpenChange,
  treatments = [],
  availabilityRecords = [],
  appointments = [],
  onCreated,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [emailError, setEmailError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setEmailError("");
      setSaveError("");
      setBusy(false);
    }
  }, [open]);

  const dayAppointments = useMemo(
    () => (Array.isArray(appointments) ? appointments : []).filter((row) => row.date === form.date),
    [appointments, form.date]
  );

  const availableSlots = useMemo(() => {
    if (!form.date) return [];
    const record = (availabilityRecords || []).find(
      (row) => row.date === form.date && row.is_active
    );
    if (!record?.slots?.length) return [];
    return filterAvailableSlots(record.slots, dayAppointments, {
      bookingDurationMinutes: Number(form.duration_minutes) || 60,
      date: form.date,
    });
  }, [availabilityRecords, dayAppointments, form.date, form.duration_minutes]);

  const setField = (field, value) => {
    if (field === "patient_email" && emailError) setEmailError("");
    if (saveError) setSaveError("");
    setForm((prev) => {
      const next = {
        ...prev,
        [field]: field === "time" ? normalizeTimeInput(value) : value,
      };
      if (field === "date") next.time = "";
      return next;
    });
  };

  const handleTreatmentChange = (treatmentId) => {
    const treatment = treatments.find((row) => String(row.id) === String(treatmentId));
    setForm((prev) => ({
      ...prev,
      treatment_id: treatmentId,
      treatment_name: treatment?.name || prev.treatment_name,
      treatment_price:
        treatment?.price != null && treatment?.price !== ""
          ? String(treatment.price)
          : prev.treatment_price,
      duration_minutes: Number(treatment?.duration_minutes || treatment?.duration || 60) || 60,
    }));
    if (saveError) setSaveError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busy) return;

    const emailResult = validateBookingEmail(form.patient_email, { required: true });
    if (!emailResult.ok) {
      setEmailError(bookingEmailErrorMessage(emailResult.error));
      return;
    }

    if (!form.patient_name.trim() || !form.patient_phone.trim()) {
      setSaveError("נא למלא שם וטלפון.");
      return;
    }
    if (!form.treatment_name.trim()) {
      setSaveError("נא לבחור או להזין טיפול.");
      return;
    }
    if (!form.date || !form.time) {
      setSaveError("נא לבחור תאריך ושעה.");
      return;
    }

    setBusy(true);
    setSaveError("");
    try {
      const result = await createAdminAppointment({
        patient_name: form.patient_name.trim(),
        patient_phone: form.patient_phone.trim(),
        patient_email: emailResult.normalized || form.patient_email.trim(),
        notes: form.notes.trim(),
        marketing_consent: Boolean(form.marketing_consent),
        treatment_id: form.treatment_id || null,
        treatment_name: form.treatment_name.trim(),
        treatment_price: form.treatment_price === "" ? null : Number(form.treatment_price),
        duration_minutes: Number(form.duration_minutes) || 60,
        paid: Boolean(form.paid),
        status: "confirmed",
        appointments: [{ date: form.date, time: normalizeTimeInput(form.time) }],
      });
      onCreated?.(result);
      onOpenChange(false);
    } catch (error) {
      setSaveError(error?.message || "לא ניתן ליצור את התור. נסו שוב.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(92dvh,920px)] w-[calc(100vw-1.25rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:w-full"
        dir="rtl"
      >
        <DialogHeader className="shrink-0 border-b border-border/70 px-4 py-4 pe-12 sm:px-6">
          <DialogTitle>תור חדש</DialogTitle>
          <p className="text-sm text-muted-foreground">
            המטופל יקבל אישור במייל ו־SMS (אם מופעל), תזכורת לפני התור, והתור ייכנס ליומן
            הקליניקה.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-name">שם מלא</Label>
                <Input
                  id="create-name"
                  value={form.patient_name}
                  onChange={(e) => setField("patient_name", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-phone">טלפון</Label>
                <Input
                  id="create-phone"
                  value={form.patient_phone}
                  onChange={(e) => setField("patient_phone", e.target.value)}
                  required
                  dir="ltr"
                  className="text-left"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-email">אימייל</Label>
              <Input
                id="create-email"
                type="email"
                value={form.patient_email}
                onChange={(e) => setField("patient_email", e.target.value)}
                required
                dir="ltr"
                className="text-left"
                aria-invalid={Boolean(emailError)}
              />
              {emailError ? (
                <p className="text-sm text-destructive" role="alert">
                  {emailError}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">חובה — לאישור ותזכורת במייל</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>טיפול</Label>
                {treatments.length > 0 ? (
                  <Select
                    value={form.treatment_id || undefined}
                    onValueChange={handleTreatmentChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="בחרי טיפול" />
                    </SelectTrigger>
                    <SelectContent>
                      {treatments.map((treatment) => (
                        <SelectItem key={treatment.id} value={String(treatment.id)}>
                          {treatment.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={form.treatment_name}
                    onChange={(e) => setField("treatment_name", e.target.value)}
                    placeholder="שם הטיפול"
                    required
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-price">מחיר טיפול</Label>
                <Input
                  id="create-price"
                  type="number"
                  min="0"
                  step="1"
                  value={form.treatment_price}
                  onChange={(e) => setField("treatment_price", e.target.value)}
                />
              </div>
            </div>

            {!form.treatment_id && treatments.length > 0 ? (
              <div className="space-y-2">
                <Label htmlFor="create-treatment-name">שם טיפול (ידני)</Label>
                <Input
                  id="create-treatment-name"
                  value={form.treatment_name}
                  onChange={(e) => setField("treatment_name", e.target.value)}
                  required
                />
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-date">תאריך</Label>
                <Input
                  id="create-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setField("date", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-time">שעה</Label>
                <Input
                  id="create-time"
                  type="time"
                  value={form.time}
                  onChange={(e) => setField("time", e.target.value)}
                  required
                />
              </div>
            </div>

            {availableSlots.length > 0 ? (
              <div className="space-y-2">
                <Label>שעות פנויות ליום זה</Label>
                <div className="flex flex-wrap gap-2">
                  {availableSlots.map((slot) => (
                    <Button
                      key={slot}
                      type="button"
                      size="sm"
                      variant={form.time === slot ? "default" : "outline"}
                      onClick={() => setField("time", slot)}
                    >
                      {slot}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>תשלום</Label>
              <Button
                type="button"
                variant="outline"
                onClick={() => setField("paid", !form.paid)}
                className="w-full justify-start gap-2"
              >
                {form.paid ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                {form.paid ? "שילם" : "לא שילם"}
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-notes">הערות</Label>
              <Textarea
                id="create-notes"
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                rows={3}
              />
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm">
              <Checkbox
                checked={form.marketing_consent}
                onCheckedChange={(checked) => setField("marketing_consent", Boolean(checked))}
              />
              <span>אישר/ה קבלת דיוור שיווקי</span>
            </label>
          </div>

          {saveError ? (
            <p className="px-4 pt-2 text-sm text-destructive sm:px-6" role="alert">
              {saveError}
            </p>
          ) : null}

          <DialogFooter className="shrink-0 gap-2 border-t border-border/70 bg-background px-4 py-3 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              ביטול
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  יוצר תור...
                </>
              ) : (
                "צור תור ושלח אישור"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
