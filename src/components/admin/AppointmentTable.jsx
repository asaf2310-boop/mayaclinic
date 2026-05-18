import React, { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { CheckCircle2, Circle, Pencil, Trash2 } from "lucide-react";

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

export default function AppointmentTable({ appointments, onStatusChange, onPaidChange, onUpdate, onDelete, isMutating }) {
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [appointmentToDelete, setAppointmentToDelete] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);

  useEffect(() => {
    if (!editingAppointment) {
      setEditForm(EMPTY_EDIT_FORM);
      return;
    }

    setEditForm({
      patient_name: editingAppointment.patient_name || "",
      patient_phone: editingAppointment.patient_phone || "",
      patient_email: editingAppointment.patient_email || "",
      treatment_name: editingAppointment.treatment_name || "",
      treatment_price: editingAppointment.treatment_price ?? "",
      date: editingAppointment.date || "",
      time: editingAppointment.time || "",
      notes: editingAppointment.notes || "",
      status: editingAppointment.status || "pending",
      paid: Boolean(editingAppointment.paid),
      marketing_consent: Boolean(editingAppointment.marketing_consent),
    });
  }, [editingAppointment]);

  const handleEditChange = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveEdit = (event) => {
    event.preventDefault();
    if (!editingAppointment) return;

    onUpdate(editingAppointment.id, {
      patient_name: editForm.patient_name,
      patient_phone: editForm.patient_phone,
      patient_email: editForm.patient_email,
      treatment_name: editForm.treatment_name,
      treatment_price: editForm.treatment_price === "" ? null : Number(editForm.treatment_price),
      date: editForm.date,
      time: editForm.time,
      notes: editForm.notes,
      status: editForm.status,
      paid: editForm.paid,
      marketing_consent: editForm.marketing_consent,
    });

    setEditingAppointment(null);
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
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => onPaidChange(apt.id, !apt.paid)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                          apt.paid
                            ? "bg-green-50 text-green-700"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {apt.paid
                          ? <CheckCircle2 className="w-4 h-4" />
                          : <Circle className="w-4 h-4" />
                        }
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
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    {renderField("טלפון", apt.patient_phone, "tabular-nums")}
                    {renderField("טיפול", apt.treatment_name)}
                    {renderField("תאריך", apt.date ? format(new Date(apt.date + "T00:00:00"), "dd/MM/yyyy") : "-", "tabular-nums")}
                    {renderField("שעה", apt.time, "tabular-nums")}
                    {renderField("הערות", apt.notes || "-")}
                  </div>
                </div>

                <div className="flex shrink-0 gap-2 lg:flex-col">
                  <Button variant="outline" size="sm" onClick={() => setEditingAppointment(apt)} className="gap-1">
                    <Pencil className="w-3.5 h-3.5" />
                    ערוך
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setAppointmentToDelete(apt)} className="gap-1 text-destructive hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                    מחק
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={Boolean(editingAppointment)} onOpenChange={(open) => !open && setEditingAppointment(null)}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת תור</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">שם מלא</Label>
                <Input id="edit-name" value={editForm.patient_name} onChange={(e) => handleEditChange("patient_name", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">טלפון</Label>
                <Input id="edit-phone" value={editForm.patient_phone} onChange={(e) => handleEditChange("patient_phone", e.target.value)} required dir="ltr" className="text-left" />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-email">אימייל</Label>
                <Input id="edit-email" type="email" value={editForm.patient_email} onChange={(e) => handleEditChange("patient_email", e.target.value)} dir="ltr" className="text-left" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-treatment">טיפול</Label>
                <Input id="edit-treatment" value={editForm.treatment_name} onChange={(e) => handleEditChange("treatment_name", e.target.value)} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-price">מחיר טיפול</Label>
              <Input id="edit-price" type="number" min="0" step="1" value={editForm.treatment_price} onChange={(e) => handleEditChange("treatment_price", e.target.value)} />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-date">תאריך</Label>
                <Input id="edit-date" type="date" value={editForm.date} onChange={(e) => handleEditChange("date", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-time">שעה</Label>
                <Input id="edit-time" type="time" value={editForm.time} onChange={(e) => handleEditChange("time", e.target.value)} required />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>סטטוס</Label>
                <Select value={editForm.status} onValueChange={(value) => handleEditChange("status", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_MAP).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>תשלום</Label>
                <Button type="button" variant="outline" onClick={() => handleEditChange("paid", !editForm.paid)} className="w-full justify-start gap-2">
                  {editForm.paid ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Circle className="w-4 h-4 text-muted-foreground" />}
                  {editForm.paid ? "שילם" : "לא שילם"}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notes">הערות</Label>
              <Textarea id="edit-notes" value={editForm.notes} onChange={(e) => handleEditChange("notes", e.target.value)} rows={3} />
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm">
              <Checkbox
                checked={editForm.marketing_consent}
                onCheckedChange={(checked) => handleEditChange("marketing_consent", Boolean(checked))}
              />
              <span>אישר/ה קבלת דיוור שיווקי</span>
            </label>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingAppointment(null)}>ביטול</Button>
              <Button type="submit" disabled={isMutating}>שמור שינויים</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(appointmentToDelete)} onOpenChange={(open) => !open && setAppointmentToDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את התור?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק את התור של {appointmentToDelete?.patient_name || "המטופל"} ולא ניתן לשחזר אותה.
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