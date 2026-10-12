import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { bookingFetch } from "@/lib/bookingMount";

const TEMPLATE_VARS = [
  "{שם}",
  "{תאריך}",
  "{שעה}",
  "{כתובת}",
  "{קישור_ניווט}",
];

function smsStatusLabel(status) {
  switch (String(status || "")) {
    case "accepted":
      return "התקבל אצל הספק";
    case "delivered":
      return "נמסר";
    case "pending":
      return "ממתין";
    case "failed":
      return "נכשל";
    case "unknown":
      return "לא ודאי";
    case "sending":
      return "בשליחה";
    case "temporary_failure":
      return "לא ודאי";
    case "permanent_failure":
    case "invalid_phone":
    case "cancelled":
      return "נכשל";
    default:
      return status || "—";
  }
}

function estimateLocalSegments(text = "") {
  const chars = [...String(text || "")].length;
  if (chars <= 0) return { chars: 0, segments: 0 };
  if (chars <= 70) return { chars, segments: 1 };
  return { chars, segments: Math.ceil(chars / 67) };
}

function formatTs(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("he-IL", {
      timeZone: "Asia/Jerusalem",
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

async function loadSettings() {
  const response = await bookingFetch("/api/admin?action=sms-reminder-settings");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "לא ניתן לטעון הגדרות SMS");
  return data;
}

async function loadHistory() {
  const response = await bookingFetch("/api/admin?action=sms-reminder-history&limit=40");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "לא ניתן לטעון היסטוריית SMS");
  return data.rows || [];
}

function TemplateEditor({
  title,
  template,
  onChange,
  onInsert,
  onRestore,
  preview,
  disabled,
}) {
  const estimate = preview?.estimate || estimateLocalSegments(preview?.message || template);
  return (
    <Card className="p-5 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          משתנים נתמכים בלבד. תצוגה מקדימה מתעדכנת בזמן אמת.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TEMPLATE_VARS.map((token) => (
          <Button
            key={token}
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => onInsert(token)}
            className="font-mono text-xs"
            dir="ltr"
          >
            {token}
          </Button>
        ))}
      </div>

      <Textarea
        value={template}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        dir="rtl"
        disabled={disabled}
        className="min-h-[160px] text-sm leading-relaxed"
      />

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={disabled} onClick={onRestore}>
          שחזור ברירת מחדל
        </Button>
      </div>

      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm space-y-2">
        <p className="font-medium">תצוגה מקדימה</p>
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
          {preview?.ok === false
            ? preview?.error === "unsupported_placeholders"
              ? `משתנים לא נתמכים: ${(preview.unsupported || []).join(", ")}`
              : preview?.error || "תצוגה לא זמינה"
            : preview?.message || template}
        </pre>
        <p className="text-xs text-muted-foreground" dir="ltr">
          {estimate.chars} chars · ~{estimate.segments} Unicode segment
          {estimate.segments === 1 ? "" : "s"} (UCS-2 / 019)
        </p>
        <p className="text-xs text-muted-foreground">
          קבלה אצל הספק אינה מאשרת מסירה לטלפון.
        </p>
      </div>
    </Card>
  );
}

export default function SmsReminderSettings() {
  const queryClient = useQueryClient();
  const [leadHours, setLeadHours] = useState(null);
  const [clinicAddress, setClinicAddress] = useState(null);
  const [confirmTemplate, setConfirmTemplate] = useState(null);
  const [reminderTemplate, setReminderTemplate] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["sms-reminder-settings"],
    queryFn: loadSettings,
  });

  const {
    data: history = [],
    isLoading: historyLoading,
    error: historyError,
  } = useQuery({
    queryKey: ["sms-reminder-history"],
    queryFn: loadHistory,
  });

  const settings = data?.settings;
  const gate = data?.gate;
  const defaults = data?.defaults;

  useEffect(() => {
    if (!settings) return;
    setClinicAddress(null);
    setConfirmTemplate(null);
    setReminderTemplate(null);
    setLeadHours(null);
  }, [settings?.updated_at]);

  const effectiveAddress = clinicAddress ?? settings?.clinic_address ?? "";
  const effectiveConfirm = confirmTemplate ?? settings?.confirm_template ?? "";
  const effectiveReminder = reminderTemplate ?? settings?.reminder_template ?? "";
  const effectiveLead = useMemo(() => {
    if (leadHours != null && String(leadHours).trim() !== "") return Number(leadHours);
    return Number(settings?.lead_hours || 24);
  }, [leadHours, settings?.lead_hours]);

  const confirmPreview = useMemo(() => {
    const local = estimateLocalSegments(
      effectiveConfirm
        .replaceAll("{שם}", "ישראל ישראלי")
        .replaceAll("{תאריך}", "20/10/2026")
        .replaceAll("{שעה}", "10:30")
        .replaceAll("{כתובת}", effectiveAddress || "...")
        .replaceAll(
          "{קישור_ניווט}",
          `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(effectiveAddress || "")}`
        )
    );
    const unsupported = [...effectiveConfirm.matchAll(/\{[^{}]+\}/g)]
      .map((m) => m[0])
      .filter((t) => !TEMPLATE_VARS.includes(t));
    if (unsupported.length) {
      return { ok: false, error: "unsupported_placeholders", unsupported: [...new Set(unsupported)], estimate: local };
    }
    const message = effectiveConfirm
      .replaceAll("{שם}", "ישראל ישראלי")
      .replaceAll("{תאריך}", "20/10/2026")
      .replaceAll("{שעה}", "10:30")
      .replaceAll("{כתובת}", effectiveAddress || "...")
      .replaceAll(
        "{קישור_ניווט}",
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(effectiveAddress || "")}`
      );
    return { ok: true, message, estimate: estimateLocalSegments(message) };
  }, [effectiveConfirm, effectiveAddress]);

  const reminderPreview = useMemo(() => {
    const unsupported = [...effectiveReminder.matchAll(/\{[^{}]+\}/g)]
      .map((m) => m[0])
      .filter((t) => !TEMPLATE_VARS.includes(t));
    const message = effectiveReminder
      .replaceAll("{שם}", "ישראל ישראלי")
      .replaceAll("{תאריך}", "20/10/2026")
      .replaceAll("{שעה}", "10:30")
      .replaceAll("{כתובת}", effectiveAddress || "...")
      .replaceAll(
        "{קישור_ניווט}",
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(effectiveAddress || "")}`
      );
    if (unsupported.length) {
      return {
        ok: false,
        error: "unsupported_placeholders",
        unsupported: [...new Set(unsupported)],
        estimate: estimateLocalSegments(message),
      };
    }
    return { ok: true, message, estimate: estimateLocalSegments(message) };
  }, [effectiveReminder, effectiveAddress]);

  const saveMutation = useMutation({
    mutationFn: async (patch) => {
      const response = await bookingFetch("/api/admin?action=sms-reminder-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || body.error || "שמירה נכשלה");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sms-reminder-settings"] });
      setLeadHours(null);
      setClinicAddress(null);
      setConfirmTemplate(null);
      setReminderTemplate(null);
    },
  });

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;
  if (error) {
    return (
      <Card className="p-6 text-center text-red-700" dir="rtl">
        {error.message}
      </Card>
    );
  }

  const reminderEnvOn = Boolean(gate?.envEnabled);
  const confirmEnvOn = Boolean(gate?.bookingConfirmEnvEnabled);
  const migrationMissing = Boolean(gate?.migrationMissing || gate?.templatesMigrationMissing);

  return (
    <div className="space-y-6 max-w-3xl pb-8" dir="rtl">
      <Card className="p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-xl font-bold">הודעות SMS למטופלים</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            אישור לאחר קביעת תור ותזכורת כ־24 שעות לפני. האוטומציה דורשת גם מתגי סביבה בשרת — הממשק לא
            יכול לעקוף אותם.
          </p>
        </div>

        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm space-y-1">
          <p>
            שער תזכורות (<span dir="ltr">SMS_REMINDERS_ENABLED</span>):{" "}
            <strong>{reminderEnvOn ? "פתוח" : "סגור"}</strong>
          </p>
          <p>
            שער אישור הזמנה (<span dir="ltr">SMS_BOOKING_CONFIRM_ENABLED</span>):{" "}
            <strong>{confirmEnvOn ? "פתוח" : "סגור"}</strong>
          </p>
          <p>
            ספק 019 מוגדר: <strong>{gate?.providerConfigured ? "כן" : "לא"}</strong>
          </p>
          <p>
            שליחת אישור חיה אפשרית:{" "}
            <strong>{gate?.bookingConfirmLiveAllowed ? "כן" : "לא"}</strong>
          </p>
          <p>
            שליחת תזכורת חיה אפשרית: <strong>{gate?.liveAllowed ? "כן" : "לא"}</strong>
          </p>
          {migrationMissing ? (
            <p className="text-destructive">
              חסרה מיגרציה — הריצו{" "}
              <span dir="ltr">supabase/appointment-sms-delivery.sql</span> ואז{" "}
              <span dir="ltr">supabase/appointment-sms-templates.sql</span>
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <Label htmlFor="sms-confirm-enabled">שליחת SMS לאחר קביעת תור</Label>
            <p className="text-xs text-muted-foreground mt-1">
              נשלח פעם אחת אחרי שמירת התור בלבד. דורש גם{" "}
              <span dir="ltr">SMS_BOOKING_CONFIRM_ENABLED=true</span>.
            </p>
          </div>
          <Switch
            id="sms-confirm-enabled"
            checked={Boolean(settings?.booking_confirm_enabled)}
            disabled={saveMutation.isPending || migrationMissing}
            onCheckedChange={(checked) =>
              saveMutation.mutate({ booking_confirm_enabled: checked })
            }
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <Label htmlFor="sms-reminder-enabled">שליחת תזכורת SMS יום לפני התור</Label>
            <p className="text-xs text-muted-foreground mt-1">
              תזכורת אחת לתור פעיל. דורש גם <span dir="ltr">SMS_REMINDERS_ENABLED=true</span>.
            </p>
          </div>
          <Switch
            id="sms-reminder-enabled"
            checked={Boolean(settings?.enabled)}
            disabled={saveMutation.isPending || migrationMissing}
            onCheckedChange={(checked) => saveMutation.mutate({ enabled: checked })}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="sms-lead">זמן לפני התור (שעות)</Label>
            <Input
              id="sms-lead"
              type="number"
              min={1}
              max={72}
              value={leadHours ?? settings?.lead_hours ?? 24}
              onChange={(e) => setLeadHours(e.target.value)}
              className="max-w-[140px]"
            />
            <p className="text-xs text-muted-foreground">ברירת מחדל 24 — לפי יום בלוח ישראל.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={saveMutation.isPending || !Number.isFinite(effectiveLead)}
            onClick={() => saveMutation.mutate({ lead_hours: effectiveLead })}
          >
            שמור זמן תזכורת
          </Button>
        </div>

        {saveMutation.isError ? (
          <p className="text-sm text-destructive">{saveMutation.error.message}</p>
        ) : null}
        {saveMutation.isSuccess ? (
          <p className="text-sm text-green-700">ההגדרות נשמרו</p>
        ) : null}
      </Card>

      <Card className="p-5 sm:p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">כתובת הקליניקה</h3>
          <p className="text-sm text-muted-foreground">
            מוצג ב־<span dir="ltr">{"{כתובת}"}</span>. קישור ניווט נוצר רק אם התבנית כוללת{" "}
            <span dir="ltr">{"{קישור_ניווט}"}</span>.
          </p>
        </div>
        <Input
          value={effectiveAddress}
          onChange={(e) => setClinicAddress(e.target.value)}
          dir="rtl"
          disabled={saveMutation.isPending || migrationMissing}
        />
        <Button
          type="button"
          variant="outline"
          disabled={saveMutation.isPending || migrationMissing}
          onClick={() =>
            saveMutation.mutate({
              clinic_address: effectiveAddress || defaults?.clinic_address,
            })
          }
        >
          שמור כתובת
        </Button>
      </Card>

      <TemplateEditor
        title="תבנית אישור קביעת תור"
        template={effectiveConfirm}
        disabled={saveMutation.isPending || migrationMissing}
        preview={confirmPreview}
        onChange={setConfirmTemplate}
        onInsert={(token) => setConfirmTemplate(`${effectiveConfirm}${token}`)}
        onRestore={() =>
          saveMutation.mutate({
            restore_confirm_default: true,
            confirm_template: defaults?.confirm_template,
          })
        }
      />
      <div className="flex justify-end">
        <Button
          type="button"
          disabled={
            saveMutation.isPending || migrationMissing || confirmPreview.ok === false
          }
          onClick={() => saveMutation.mutate({ confirm_template: effectiveConfirm })}
        >
          שמור תבנית אישור
        </Button>
      </div>

      <TemplateEditor
        title="תבנית תזכורת יום לפני"
        template={effectiveReminder}
        disabled={saveMutation.isPending || migrationMissing}
        preview={reminderPreview}
        onChange={setReminderTemplate}
        onInsert={(token) => setReminderTemplate(`${effectiveReminder}${token}`)}
        onRestore={() =>
          saveMutation.mutate({
            restore_reminder_default: true,
            reminder_template: defaults?.reminder_template,
          })
        }
      />
      <div className="flex justify-end">
        <Button
          type="button"
          disabled={
            saveMutation.isPending || migrationMissing || reminderPreview.ok === false
          }
          onClick={() => saveMutation.mutate({ reminder_template: effectiveReminder })}
        >
          שמור תבנית תזכורת
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b p-5">
          <h3 className="text-lg font-semibold">היסטוריית שליחות SMS</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            סטטוס אחרון לפי סוג הודעה. קבלה אצל הספק ≠ מסירה לטלפון.
          </p>
        </div>
        {historyLoading ? (
          <div className="p-5">
            <Skeleton className="h-32 rounded-lg" />
          </div>
        ) : historyError ? (
          <p className="p-5 text-sm text-destructive">{historyError.message}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-right text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {["תאריך תור", "סוג", "טלפון", "נשלח", "סטטוס"].map((h) => (
                    <th key={h} className="p-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-3 tabular-nums">
                      {row.date}
                      {row.time ? ` · ${row.time}` : ""}
                    </td>
                    <td className="p-3">{row.type_label || row.type || "—"}</td>
                    <td className="p-3 tabular-nums" dir="ltr">
                      {row.patient_phone_masked || "****"}
                    </td>
                    <td className="p-3 tabular-nums text-xs">{formatTs(row.timestamp)}</td>
                    <td className="p-3">{smsStatusLabel(row.status || row.provider_status)}</td>
                  </tr>
                ))}
                {!history.length ? (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-muted-foreground">
                      עדיין אין שליחות SMS
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
