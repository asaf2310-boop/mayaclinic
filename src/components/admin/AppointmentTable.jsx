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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { CheckCircle2, Circle, Loader2, Pencil, Trash2 } from "lucide-react";
import { verifyMeridianTreatmentId } from "@/lib/meridianBooking";

const STATUS_MAP = {
  pending: { label: "ממתין" },
  confirmed: { label: "מאושר" },
  cancelled: { label: "בוטל" },
  completed: { label: "הושלם" },
};

const EMPTY_EDIT_FORM = {
  patient_name: "",
  patient_phone: "",
  patient_email: "",
  treatment_name: "",
  treatment_price: "",
  date: "",
  time: "",
  notes: "",
  status: "pending",
  paid: false,
  marketing_consent: false,
};

function extractVerifiedMeridianId(notes) {
  const match = String(notes || "").match(/מזהה טיפול מרידיאן שאומת:\s*(\d+)/);
  return match?.[1] || "";
}

/** Prefer verified state when notes still contain a leftover "pending" line. */
function getMeridianBadge(appointment) {
  const notes = String(appointment?.notes || "");
  const verifiedId = extractVerifiedMeridianId(notes);
  if (verifiedId) {
    return {
      kind: "verified",
      label: `מרידיאן — אומת (${verifiedId})`,
      className: "text-green-700",
    };
  }
  if (/מרידיאן/.test(notes) && /ממתין לאימות/.test(notes)) {
    return {
      kind: "pending",
      label: "מרידיאן — ממתין לאימות מזהה",
      className: "text-amber-700",
    };
  }
  if (/מרידיאן/.test(notes)) {
    return {
      kind: "info",
      label: "מרידיאן",
      className: "text-muted-foreground",
    };
  }
  return null;
}

/** Hide contradictory pending Meridian lines once a verified ID exists. */
function formatNotesForDisplay(notes) {
  const text = String(notes || "");
  const verifiedId = extractVerifiedMeridianId(text);
  if (!verifiedId) return text || "-";
  return (
    text
      .split(/\r?\n+/)
      .map((line) =>
        String(line || "")
          .replace(/תשלום דרך מרידיאן\s*[—–\-:]?\s*ממתין לאימות מזהה טיפול/g, "")
          .replace(/מרידיאן\s*[—–\-:]?\s*ממתין לאימות[^\n]*/g, "")
          .replace(/ממתין לאימות מזהה טיפול/g, "")
          .trim()
      )
      .filter(Boolean)
      .join("\n") || `מזהה טיפול מרידיאן שאומת: ${verifiedId}`
  );
}

export default function AppointmentTable({
  appointments,
  onStatusChange,
  onPaidChange,
  onUpdate,
  onDelete,
  onRefresh,
  isMutating,
}) {
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [appointmentToDelete, setAppointmentToDelete] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [meridianIdInput, setMeridianIdInput] = useState("");
  const [meridianBusy, setMeridianBusy] = useState(false);
  const [meridianError, setMeridianError] = useState("");
  const [meridianSuccess, setMeridianSuccess] = useState("");

  useEffect(() => {
    if (!editingAppointment) {
      setEditForm(EMPTY_EDIT_FORM);
      setMeridianIdInput("");
      setMeridianError("");
      setMeridianSuccess("");
      setMeridianBusy(false);
      return;
    }

    const rawNotes = editingAppointment.notes || "";
    const cleanedNotes = formatNotesForDisplay(rawNotes);
    setEditForm({
      patient_name: editingAppointment.patient_name || "",
      patient_phone: editingAppointment.patient_phone || "",
      patient_email: editingAppointment.patient_email || "",
      treatment_name: editingAppointment.treatment_name || "",
      treatment_price: editingAppointment.treatment_price ?? "",
      date: editingAppointment.date || "",
      time: editingAppointment.time || "",
      notes: cleanedNotes === "-" ? "" : cleanedNotes,
      status: editingAppointment.status || "pending",
      paid: Boolean(editingAppointment.paid),
      marketing_consent: Boolean(editingAppointment.marketing_consent),
    });
    setMeridianIdInput(extractVerifiedMeridianId(rawNotes));
    setMeridianError("");
    setMeridianSuccess("");
  }, [editingAppointment]);

  const handleEditChange = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveEdit = (event) => {
    event.preventDefault();
    if (!editingAppointment) return;

    const notesToSave = formatNotesForDisplay(editForm.notes);
    onUpdate(editingAppointment.id, {
      patient_name: editForm.patient_name,
      patient_phone: editForm.patient_phone,
      patient_email: editForm.patient_email,
      treatment_name: editForm.treatment_name,
      treatment_price: editForm.treatment_price === "" ? null : Number(editForm.treatment_price),
      date: editForm.date,
      time: editForm.time,
      notes: notesToSave === "-" ? "" : notesToSave,
      status: editForm.status,
      paid: editForm.paid,
      marketing_consent: editForm.marketing_consent,
    });

    setEditingAppointment(null);
  };

  const handleVerifyMeridian = async () => {
    if (!editingAppointment) return;
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
        appointmentIds: [editingAppointment.id],
        treatmentId: digits,
      });
      const updated = Array.isArray(result?.appointments)
        ? result.appointments.find((row) => row.id === editingAppointment.id) ||
          result.appointments[0]
        : null;

      if (updated) {
        setEditingAppointment(updated);
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

  const renderField = (label, value, className = "") => (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium text-foreground ${className}`}>{value || "-"}</p>
    </div>
  );

  return (
    <>
      <div className="space-y-4" dir="rtl">
        {appointments.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card py-12 text-center text-muted-foreground">
            אין תורים עדיין
          </div>
        ) : (
          appointments.map((apt) => (
            <div key={apt.id} className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">מטופל</p>
                      <h3 className="text-lg font-bold text-foreground">{apt.patient_name}</h3>
                      {(() => {
                        const badge = getMeridianBadge(apt);
                        if (!badge) return null;
                        return (
                          <p className={`mt-1 text-xs font-medium ${badge.className}`}>
                            {badge.label}
                          </p>
                        );
                      })()}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onPaidChange(apt.id, !apt.paid)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                          apt.paid
                            ? "bg-green-50 text-green-700"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {apt.paid ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Circle className="h-4 w-4" />
                        )}
                        {apt.paid ? "שילם" : "לא שילם"}
                      </button>
                      <Select
                        value={apt.status || "pending"}
                        onValueChange={(val) => onStatusChange(apt.id, val)}
                      >
                        <SelectTrigger className="h-8 w-32 rounded-full text-right">
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
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
                    {renderField("טלפון", apt.patient_phone, "tabular-nums")}
                    {renderField("טיפול", apt.treatment_name)}
                    {renderField(
                      "מחיר טיפול",
                      apt.treatment_price
                        ? `₪${Number(apt.treatment_price).toLocaleString("he-IL")}`
                        : "-"
                    )}
                    {renderField(
                      "תאריך",
                      apt.date
                        ? format(new Date(`${apt.date}T00:00:00`), "dd/MM/yyyy")
                        : "-",
                      "tabular-nums"
                    )}
                    {renderField("שעה", apt.time, "tabular-nums")}
                    {renderField("הערות", formatNotesForDisplay(apt.notes))}
                  </div>
                </div>

                <div className="flex shrink-0 gap-2 lg:flex-col">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingAppointment(apt)}
                    className="gap-1"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    ערוך
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAppointmentToDelete(apt)}
                    className="gap-1 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    מחק
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog
        open={Boolean(editingAppointment)}
        onOpenChange={(open) => !open && setEditingAppointment(null)}
      >
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
                  />
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

            <DialogFooter className="shrink-0 gap-2 border-t border-border/70 bg-background px-4 py-3 sm:px-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingAppointment(null)}
              >
                ביטול
              </Button>
              <Button type="submit" disabled={isMutating || meridianBusy}>
                שמור שינויים
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(appointmentToDelete)}
        onOpenChange={(open) => !open && setAppointmentToDelete(null)}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את התור?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק את התור של {appointmentToDelete?.patient_name || "המטופל"} ולא ניתן
              לשחזר אותה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (appointmentToDelete) {
                  onDelete(appointmentToDelete.id);
                  setAppointmentToDelete(null);
                }
              }}
            >
              מחק תור
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
