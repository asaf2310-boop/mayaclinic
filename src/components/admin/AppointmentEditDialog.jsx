import React, { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  bookingEmailErrorMessage,
  validateBookingEmail,
} from "@/lib/bookingEmailValidation";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { verifyMeridianTreatmentId } from "@/lib/meridianBooking";
import {
  EMPTY_EDIT_FORM,
  STATUS_MAP,
  extractVerifiedMeridianId,
  formatNotesForDisplay,
  getEmailDeliveryWarning,
  normalizeTimeInput,
} from "@/components/admin/appointmentTableShared";

/**
 * Owns edit-form state so typing does not re-render the appointment list.
 */
export default function AppointmentEditDialog({
  appointment,
  open,
  onOpenChange,
  onUpdate,
  onRefresh,
  isMutating,
  updateError = "",
}) {
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [meridianIdInput, setMeridianIdInput] = useState("");
  const [meridianBusy, setMeridianBusy] = useState(false);
  const [meridianError, setMeridianError] = useState("");
  const [meridianSuccess, setMeridianSuccess] = useState("");
  const [editEmailError, setEditEmailError] = useState("");
  const [editSaveError, setEditSaveError] = useState("");
  const [activeAppointment, setActiveAppointment] = useState(appointment);

  useEffect(() => {
    if (!open || !appointment) {
      setEditForm(EMPTY_EDIT_FORM);
      setMeridianIdInput("");
      setMeridianError("");
      setMeridianSuccess("");
      setMeridianBusy(false);
      setEditEmailError("");
      setEditSaveError("");
      setActiveAppointment(null);
      return;
    }

    const rawNotes = appointment.notes || "";
    const cleanedNotes = formatNotesForDisplay(rawNotes);
    setActiveAppointment(appointment);
    setEditForm({
      patient_name: appointment.patient_name || "",
      patient_phone: appointment.patient_phone || "",
      patient_email: appointment.patient_email || "",
      treatment_name: appointment.treatment_name || "",
      treatment_price: appointment.treatment_price ?? "",
      date: appointment.date || "",
      time: normalizeTimeInput(appointment.time),
      notes: cleanedNotes === "-" ? "" : cleanedNotes,
      status: appointment.status || "pending",
      paid: Boolean(appointment.paid),
      marketing_consent: Boolean(appointment.marketing_consent),
    });
    setMeridianIdInput(extractVerifiedMeridianId(rawNotes));
    setMeridianError("");
    setMeridianSuccess("");
    setEditEmailError("");
    setEditSaveError("");
  }, [appointment, open]);

  const handleEditChange = (field, value) => {
    if (field === "patient_email" && editEmailError) setEditEmailError("");
    if (editSaveError) setEditSaveError("");
    setEditForm((prev) => ({
      ...prev,
      [field]: field === "time" ? normalizeTimeInput(value) : value,
    }));
  };

  const handleSaveEdit = async (event) => {
    event.preventDefault();
    if (!activeAppointment || isMutating) return;

    const emailResult = validateBookingEmail(editForm.patient_email, { required: false });
    if (!emailResult.ok) {
      setEditEmailError(bookingEmailErrorMessage(emailResult.error));
      return;
    }
    setEditEmailError("");
    setEditSaveError("");

    const notesToSave = formatNotesForDisplay(editForm.notes);
    try {
      await onUpdate(
        activeAppointment.id,
        {
          patient_name: editForm.patient_name,
          patient_phone: editForm.patient_phone,
          patient_email: emailResult.normalized || "",
          treatment_name: editForm.treatment_name,
          treatment_price: editForm.treatment_price === "" ? null : Number(editForm.treatment_price),
          date: editForm.date,
          time: normalizeTimeInput(editForm.time),
          notes: notesToSave === "-" ? "" : notesToSave,
          status: editForm.status,
          paid: editForm.paid,
          marketing_consent: editForm.marketing_consent,
        },
        { previousDate: activeAppointment.date || null }
      );
      onOpenChange(false);
    } catch (error) {
      setEditSaveError(
        error?.message || updateError || "לא הצלחנו לשמור את השינויים. נסו שוב."
      );
    }
  };

  const handleVerifyMeridian = async () => {
    if (!activeAppointment) return;
    const digits = String(meridianIdInput || "").replace(/\D/g, "");
    if (digits.length < 6) {
      setMeridianError("נא להזין מזהה טיפול תקין ממרידיאן (לפחות 6 ספרות)");
      setMeridianSuccess("");
      return;
    }

    setMeridianBusy(true);
    setMeridianError("");
    setMeridianSuccess("");
    try {
      const result = await verifyMeridianTreatmentId({
        appointmentIds: [activeAppointment.id],
        treatmentId: digits,
      });
      const updated = Array.isArray(result?.appointments)
        ? result.appointments.find((row) => row.id === activeAppointment.id) ||
          result.appointments[0]
        : null;

      if (updated) {
        setActiveAppointment(updated);
        setEditForm((prev) => ({
          ...prev,
          notes: updated.notes || prev.notes,
          paid: Boolean(updated.paid),
          status: updated.status || prev.status,
        }));
        setMeridianIdInput(extractVerifiedMeridianId(updated.notes) || digits);
      }

      setMeridianSuccess(
        result?.alreadyVerified
          ? "המזהה כבר אומת בעבר — עודכנו ההערות."
          : "המזהה אומת בהצלחה. נשלח מייל אישור למטופל ולקליניקה."
      );
      if (typeof onRefresh === "function") onRefresh();
    } catch (error) {
      setMeridianError(error?.message || "לא ניתן לאמת את המזהה כרגע");
    } finally {
      setMeridianBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(92dvh,920px)] w-[calc(100vw-1.25rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:w-full"
        dir="rtl"
      >
        <DialogHeader className="shrink-0 border-b border-border/70 px-4 py-4 pe-12 sm:px-6">
          <DialogTitle>עריכת תור</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSaveEdit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4">
              <div>
                <p className="text-sm font-semibold text-amber-950">אימות מזהה מרידיאן</p>
                <p className="mt-1 text-xs leading-5 text-amber-900/80">
                  הזינו את מזהה הטיפול ממרידיאן. אחרי אימות מוצלח יישלח מייל אישור למטופל
                  ולקליניקה.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-meridian-id">מזהה טיפול מרידיאן</Label>
                <Input
                  id="edit-meridian-id"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="לדוגמה 123456789"
                  value={meridianIdInput}
                  onChange={(e) => {
                    setMeridianIdInput(e.target.value.replace(/[^\d]/g, ""));
                    if (meridianError) setMeridianError("");
                    if (meridianSuccess) setMeridianSuccess("");
                  }}
                  dir="ltr"
                  className="text-left tracking-wide"
                />
              </div>
              <Button
                type="button"
                onClick={handleVerifyMeridian}
                disabled={meridianBusy || isMutating}
                className="w-full gap-2 sm:w-auto"
              >
                {meridianBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {meridianBusy ? "מאמת מזהה..." : "אמת מזהה מרידיאן"}
              </Button>
              {meridianError ? (
                <p className="text-sm text-destructive">{meridianError}</p>
              ) : null}
              {meridianSuccess ? (
                <p className="text-sm font-medium text-green-700">{meridianSuccess}</p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-name">שם מלא</Label>
                <Input
                  id="edit-name"
                  value={editForm.patient_name}
                  onChange={(e) => handleEditChange("patient_name", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">טלפון</Label>
                <Input
                  id="edit-phone"
                  value={editForm.patient_phone}
                  onChange={(e) => handleEditChange("patient_phone", e.target.value)}
                  required
                  dir="ltr"
                  className="text-left"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-email">אימייל</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.patient_email}
                  onChange={(e) => handleEditChange("patient_email", e.target.value)}
                  dir="ltr"
                  className="text-left"
                  aria-invalid={Boolean(editEmailError)}
                />
                {editEmailError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {editEmailError}
                  </p>
                ) : null}
                {getEmailDeliveryWarning(activeAppointment) ? (
                  <p className="text-xs text-amber-800">
                    {getEmailDeliveryWarning(activeAppointment)} תיקון הכתובת יסיר חסימה לשליחות
                    עתידיות בלבד (ללא שליחה אוטומטית מחדש של אישור ישן).
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-treatment">טיפול</Label>
                <Input
                  id="edit-treatment"
                  value={editForm.treatment_name}
                  onChange={(e) => handleEditChange("treatment_name", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-price">מחיר טיפול</Label>
              <Input
                id="edit-price"
                type="number"
                min="0"
                step="1"
                value={editForm.treatment_price}
                onChange={(e) => handleEditChange("treatment_price", e.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-date">תאריך</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editForm.date}
                  onChange={(e) => handleEditChange("date", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-time">שעה</Label>
                <Input
                  id="edit-time"
                  type="time"
                  value={editForm.time}
                  onChange={(e) => handleEditChange("time", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>סטטוס</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(value) => handleEditChange("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_MAP).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>תשלום</Label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleEditChange("paid", !editForm.paid)}
                  className="w-full justify-start gap-2"
                >
                  {editForm.paid ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  {editForm.paid ? "שילם" : "לא שילם"}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notes">הערות</Label>
              <Textarea
                id="edit-notes"
                value={editForm.notes}
                onChange={(e) => handleEditChange("notes", e.target.value)}
                rows={3}
              />
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm">
              <Checkbox
                checked={editForm.marketing_consent}
                onCheckedChange={(checked) =>
                  handleEditChange("marketing_consent", Boolean(checked))
                }
              />
              <span>אישר/ה קבלת דיוור שיווקי</span>
            </label>
          </div>

          {(editSaveError || updateError) && (
            <p className="px-4 pt-2 text-sm text-destructive sm:px-6" role="alert">
              {editSaveError || updateError}
            </p>
          )}

          <DialogFooter className="shrink-0 gap-2 border-t border-border/70 bg-background px-4 py-3 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isMutating}
            >
              ביטול
            </Button>
            <Button type="submit" disabled={isMutating || meridianBusy}>
              {isMutating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  שומר...
                </>
              ) : (
                "שמור שינויים"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
