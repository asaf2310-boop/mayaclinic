import React, { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { format } from "date-fns";
import { CheckCircle2, Circle, ExternalLink, Pencil, Trash2 } from "lucide-react";
import AppointmentEditDialog from "@/components/admin/AppointmentEditDialog";
import {
  STATUS_MAP,
  emailDeliveryStatusLabel,
  formatNotesForDisplay,
  getEmailDeliveryWarning,
  getMeridianBadge,
  getSmsDeliveryWarning,
  invoice4uDisplayLabel,
} from "@/components/admin/appointmentTableShared";

function renderInvoiceField(invoice) {
  const label = invoice4uDisplayLabel(invoice);
  if (!label) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">חשבונית Invoice4U</p>
        <p className="text-sm font-medium text-foreground">-</p>
      </div>
    );
  }

  const pdfUrl = invoice?.ok && invoice?.pdfUrl ? String(invoice.pdfUrl).trim() : "";

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">חשבונית Invoice4U</p>
      <p
        className={`text-sm font-medium ${
          invoice?.ok ? "text-foreground" : "text-amber-800"
        }`}
      >
        {label}
      </p>
      {pdfUrl ? (
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          <ExternalLink className="h-3 w-3" aria-hidden />
          פתח העתק PDF
        </a>
      ) : null}
    </div>
  );
}

function renderField(label, value, className = "") {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium text-foreground ${className}`}>{value || "-"}</p>
    </div>
  );
}

const AppointmentCard = React.memo(function AppointmentCard({
  apt,
  onPaidChange,
  onStatusChange,
  onEdit,
  onDelete,
}) {
  const badge = getMeridianBadge(apt);
  const emailWarning = getEmailDeliveryWarning(apt);
  const smsWarning = getSmsDeliveryWarning(apt);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs text-muted-foreground">מטופל</p>
              <h3 className="text-lg font-bold text-foreground">{apt.patient_name}</h3>
              {badge ? (
                <p className={`mt-1 text-xs font-medium ${badge.className}`}>{badge.label}</p>
              ) : null}
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
            {renderField("אימייל", apt.patient_email || "-", "break-all")}
            {renderField("טיפול", apt.treatment_name)}
            {renderField(
              "מחיר טיפול",
              apt.treatment_price
                ? `₪${Number(apt.treatment_price).toLocaleString("he-IL")}`
                : "-"
            )}
            {renderField(
              "תאריך",
              apt.date ? format(new Date(`${apt.date}T00:00:00`), "dd/MM/yyyy") : "-",
              "tabular-nums"
            )}
            {renderField("שעה", apt.time, "tabular-nums")}
            {renderField("הערות", formatNotesForDisplay(apt.notes))}
            {renderInvoiceField(apt.invoice4u)}
            {renderField(
              "סטטוס אימייל אישור",
              emailDeliveryStatusLabel(apt.confirmation_email_status) ||
                (apt.confirmation_sent_at ? "התקבל לשליחה" : "-")
            )}
            {renderField(
              "סטטוס תזכורת אימייל",
              emailDeliveryStatusLabel(apt.reminder_email_status) ||
                (apt.reminder_sent_at ? "התקבל לשליחה" : "-")
            )}
            {renderField(
              "סטטוס תזכורת SMS",
              emailDeliveryStatusLabel(apt.reminder_sms_status) ||
                (apt.reminder_sms_sent_at ? "התקבל אצל הספק" : "-")
            )}
          </div>
          {emailWarning ? (
            <div
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              role="status"
            >
              {emailWarning}
            </div>
          ) : null}
          {smsWarning ? (
            <div
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              role="status"
            >
              {smsWarning}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 gap-2 lg:flex-col">
          <Button type="button" variant="outline" size="sm" onClick={() => onEdit(apt)} className="gap-1">
            <Pencil className="h-3.5 w-3.5" />
            ערוך
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDelete(apt)}
            className="gap-1 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            מחק
          </Button>
        </div>
      </div>
    </div>
  );
});

export default function AppointmentTable({
  appointments,
  emptyMessage = "אין תורים עדיין",
  onStatusChange,
  onPaidChange,
  onUpdate,
  onDelete,
  onRefresh,
  isMutating,
  updateError = "",
  onEditingChange,
}) {
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [appointmentToDelete, setAppointmentToDelete] = useState(null);

  useEffect(() => {
    onEditingChange?.(Boolean(editingAppointment));
  }, [editingAppointment, onEditingChange]);

  return (
    <>
      <div className="space-y-4" dir="rtl">
        {appointments.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card py-12 text-center text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          appointments.map((apt) => (
            <AppointmentCard
              key={apt.id}
              apt={apt}
              onPaidChange={onPaidChange}
              onStatusChange={onStatusChange}
              onEdit={setEditingAppointment}
              onDelete={setAppointmentToDelete}
            />
          ))
        )}
      </div>

      <AppointmentEditDialog
        appointment={editingAppointment}
        open={Boolean(editingAppointment)}
        onOpenChange={(open) => {
          if (!open) setEditingAppointment(null);
        }}
        onUpdate={onUpdate}
        onRefresh={onRefresh}
        isMutating={isMutating}
        updateError={updateError}
      />

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
