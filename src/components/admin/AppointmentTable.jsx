import React, { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { CheckCircle2, Circle, Pencil, Trash2 } from "lucide-react";

const STATUS_MAP = {
  pending: { label: "ממתין", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  confirmed: { label: "מאושר", className: "bg-primary/10 text-primary border-primary/20" },
  cancelled: { label: "בוטל", className: "bg-destructive/10 text-destructive border-destructive/20" },
  completed: { label: "הושלם", className: "bg-green-100 text-green-800 border-green-200" },
};

const headClass = "text-right whitespace-nowrap px-4";
const cellClass = "text-right align-middle px-4";
const numericCellClass = "text-right align-middle px-4 tabular-nums whitespace-nowrap";

const EMPTY_EDIT_FORM = {
  patient_name: "",
  patient_phone: "",
  patient_email: "",
  treatment_name: "",
  date: "",
  time: "",
  notes: "",
  status: "pending",
  paid: false,
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
      date: editingAppointment.date || "",
      time: editingAppointment.time || "",
      notes: editingAppointment.notes || "",
      status: editingAppointment.status || "pending",
      paid: Boolean(editingAppointment.paid),
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
      date: editForm.date,
      time: editForm.time,
      notes: editForm.notes,
      status: editForm.status,
      paid: editForm.paid,
    });

    setEditingAppointment(null);
  };

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border/60 bg-card">
        <Table dir="rtl" className="min-w-[1050px] table-fixed">
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className={`${headClass} w-[140px]`}>מטופל</TableHead>
              <TableHead className={`${headClass} w-[130px]`}>טלפון</TableHead>
              <TableHead className={`${headClass} w-[140px]`}>טיפול</TableHead>
              <TableHead className={`${headClass} w-[115px]`}>תאריך</TableHead>
              <TableHead className={`${headClass} w-[90px]`}>שעה</TableHead>
              <TableHead className={`${headClass} w-[120px]`}>שילם</TableHead>
              <TableHead className={`${headClass} w-[135px]`}>סטטוס</TableHead>
              <TableHead className={`${headClass} w-[170px]`}>הערות</TableHead>
              <TableHead className={`${headClass} w-[155px]`}>פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                  אין תורים עדיין
                </TableCell>
              </TableRow>
            ) : (
              appointments.map((apt) => (
                <TableRow key={apt.id} className="hover:bg-muted/20">
                  <TableCell className={`${cellClass} font-medium truncate`}>{apt.patient_name}</TableCell>
                  <TableCell dir="ltr" className={`${numericCellClass} font-medium`}>{apt.patient_phone}</TableCell>
                  <TableCell className={`${cellClass} truncate`}>{apt.treatment_name}</TableCell>
                  <TableCell className={numericCellClass}>{apt.date ? format(new Date(apt.date + "T00:00:00"), "dd/MM/yyyy") : "-"}</TableCell>
                  <TableCell className={numericCellClass}>{apt.time}</TableCell>
                  <TableCell className={cellClass}>
                    <button
                      onClick={() => onPaidChange(apt.id, !apt.paid)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
                    >
                      {apt.paid
                        ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                        : <Circle className="w-5 h-5 text-muted-foreground/40" />
                      }
                      <span className={apt.paid ? "text-green-600" : "text-muted-foreground"}>
                        {apt.paid ? "שילם" : "לא שילם"}
                      </span>
                    </button>
                  </TableCell>
                  <TableCell className={cellClass}>
                    <Select
                      value={apt.status || "pending"}
                      onValueChange={(val) => onStatusChange(apt.id, val)}
                    >
                      <SelectTrigger className="w-28 h-8 text-right">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_MAP).map(([key, { label }]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className={`${cellClass} truncate text-muted-foreground text-sm`}>
                    {apt.notes || "-"}
                  </TableCell>
                  <TableCell className={cellClass}>
                    <div className="flex justify-start gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditingAppointment(apt)} className="gap-1">
                        <Pencil className="w-3.5 h-3.5" />
                        ערוך
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setAppointmentToDelete(apt)} className="gap-1 text-destructive hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                        מחק
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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