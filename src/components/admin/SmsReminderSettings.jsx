import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { bookingFetch } from "@/lib/bookingMount";

function smsStatusLabel(status) {
  switch (String(status || "")) {
    case "accepted":
      return "התקבל אצל הספק";
    case "delivered":
      return "נמסר";
    case "sending":
      return "בשליחה";
    case "temporary_failure":
      return "כשל / לא ודאי (ללא ניסיון חוזר)";
    case "permanent_failure":
      return "כשל קבוע";
    case "invalid_phone":
      return "מספר לא תקין";
    case "cancelled":
      return "בוטל";
    case "pending":
      return "ממתין";
    default:
      return status || "—";
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

const LIVE_TEST_FALLBACK = {
  phone: "0502677765",
  message:
    "בדיקת SMS ממערכת OfirBaby. אם קיבלת הודעה זו, שירות התזכורות פועל בהצלחה.",
  sender: "0549000301",
};

async function loadLiveTestPreview() {
  const response = await bookingFetch("/api/admin?action=sms-live-test");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "לא ניתן לטעון תצוגת בדיקה חיה");
  return data.preview || LIVE_TEST_FALLBACK;
}

export default function SmsReminderSettings() {
  const queryClient = useQueryClient();
  const [leadHours, setLeadHours] = useState(null);
  const [testPhone, setTestPhone] = useState("");
  const [testResult, setTestResult] = useState(null);
  const [liveTestResult, setLiveTestResult] = useState(null);

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

  const { data: livePreview = LIVE_TEST_FALLBACK } = useQuery({
    queryKey: ["sms-live-test-preview"],
    queryFn: loadLiveTestPreview,
  });

  const settings = data?.settings;
  const gate = data?.gate;

  const effectiveLead = useMemo(() => {
    if (leadHours != null && String(leadHours).trim() !== "") return Number(leadHours);
    return Number(settings?.lead_hours || 24);
  }, [leadHours, settings?.lead_hours]);

  const saveMutation = useMutation({
    mutationFn: async (patch) => {
      const response = await bookingFetch("/api/admin?action=sms-reminder-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "שמירה נכשלה");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sms-reminder-settings"] });
      setLeadHours(null);
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const response = await bookingFetch("/api/admin?action=sms-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: testPhone,
          confirm: true,
          // Prefer 019 /api/test — never force live from this UI.
          useLive: false,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || body.message || "בדיקת SMS נכשלה");
      return body;
    },
    onSuccess: (body) => {
      setTestResult(body);
      queryClient.invalidateQueries({ queryKey: ["sms-reminder-history"] });
    },
    onError: (err) => {
      setTestResult({ ok: false, error: err.message });
    },
  });

  const liveTestMutation = useMutation({
    mutationFn: async () => {
      const response = await bookingFetch("/api/admin?action=sms-live-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm: true,
          phone: livePreview?.phone || LIVE_TEST_FALLBACK.phone,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const err = new Error(body.message || body.error || "שליחת SMS חי נכשלה");
        err.payload = body;
        throw err;
      }
      return body;
    },
    onSuccess: (body) => {
      setLiveTestResult(body);
    },
    onError: (err) => {
      setLiveTestResult(err.payload || { ok: false, error: err.message, accepted: false });
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

  const liveReady = Boolean(gate?.liveAllowed);
  const envOn = Boolean(gate?.envEnabled);

  return (
    <div className="space-y-6 max-w-3xl" dir="rtl">
      <Card className="p-6 space-y-5">
        <div>
          <h2 className="text-xl font-bold">תזכורות SMS (019)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            תזכורת אחת כ־24 שעות לפני התור. אוטומציה כבויה כברירת מחדל ודורשת גם מתג סביבה בשרת.
          </p>
        </div>

        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm space-y-1">
          <p>
            שער סביבה (Vercel <span dir="ltr">SMS_REMINDERS_ENABLED</span>):{" "}
            <strong>{envOn ? "פתוח" : "סגור (ברירת מחדל)"}</strong>
          </p>
          <p>
            ספק 019 מוגדר: <strong>{gate?.providerConfigured ? "כן" : "לא"}</strong>
          </p>
          <p>
            שליחה חיה אפשרית כעת: <strong>{liveReady ? "כן" : "לא"}</strong>
          </p>
          {gate?.migrationMissing ? (
            <p className="text-destructive">
              חסרה מיגרציה — הריצו <span dir="ltr">supabase/appointment-sms-delivery.sql</span>
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="sms-enabled">הפעלת תזכורות SMS (אדמין)</Label>
            <p className="text-xs text-muted-foreground mt-1">
              גם כשמופעל כאן, ה-cron ישלח רק אם <span dir="ltr">SMS_REMINDERS_ENABLED=true</span>.
            </p>
          </div>
          <Switch
            id="sms-enabled"
            checked={Boolean(settings?.enabled)}
            disabled={saveMutation.isPending || gate?.migrationMissing}
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
            <p className="text-xs text-muted-foreground">ברירת מחדל 24 — cron מכוון לפי יום בלוח ישראל.</p>
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

      <Card className="p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">בדיקת SMS</h3>
          <p className="text-sm text-muted-foreground">
            שולח ל־endpoint הבדיקה של 019 בלבד (ללא שליחה חיה). נדרש אישור מפורש.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sms-test-phone">מספר נייד לבדיקה</Label>
          <Input
            id="sms-test-phone"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            placeholder="05XXXXXXXX"
            dir="ltr"
            className="max-w-xs"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={testMutation.isPending || !testPhone.trim()}
          onClick={() => {
            const ok = window.confirm(
              "לשלוח בקשת בדיקת SMS? (ייעשה שימוש ב-endpoint בדיקה של 019 — לא שליחה חיה)"
            );
            if (!ok) return;
            setTestResult(null);
            testMutation.mutate();
          }}
        >
          שליחת בדיקה (מאושרת)
        </Button>
        {testResult ? (
          <div
            className={`rounded-lg border px-3 py-2 text-sm ${
              testResult.ok ? "border-green-300 bg-green-50 text-green-900" : "border-destructive/30 bg-destructive/5 text-destructive"
            }`}
          >
            {testResult.ok
              ? testResult.note || "בקשת הבדיקה התקבלה"
              : testResult.error || "הבדיקה נכשלה"}
            {testResult.shipmentId ? (
              <div className="mt-1 font-mono text-xs" dir="ltr">
                shipment: {testResult.shipmentId}
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card className="p-6 space-y-4 border-amber-200 bg-amber-50/40">
        <div>
          <h3 className="text-lg font-semibold">שליחת SMS אמיתי לבדיקה</h3>
          <p className="text-sm text-muted-foreground">
            שולח הודעה אחת בלבד דרך ה-API החי של 019 (
            <span dir="ltr">/api</span>
            ), לא דרך endpoint הבדיקה. האוטומציה נשארת כבויה — לא דורש{" "}
            <span dir="ltr">SMS_REMINDERS_ENABLED=true</span>.
          </p>
        </div>

        <div className="rounded-lg border bg-background px-4 py-3 text-sm space-y-2">
          <p>
            יעד:{" "}
            <strong className="tabular-nums" dir="ltr">
              {livePreview?.phone || LIVE_TEST_FALLBACK.phone}
            </strong>
          </p>
          <p>
            שולח:{" "}
            <strong className="tabular-nums" dir="ltr">
              {livePreview?.sender || LIVE_TEST_FALLBACK.sender}
            </strong>
          </p>
          <p className="whitespace-pre-wrap leading-relaxed">
            תוכן ההודעה:
            <br />
            <span className="font-medium">{livePreview?.message || LIVE_TEST_FALLBACK.message}</span>
          </p>
          {livePreview?.providerConfigured === false ? (
            <p className="text-destructive">ספק 019 אינו מוגדר בשרת — לא ניתן לשלוח.</p>
          ) : null}
        </div>

        <Button
          type="button"
          variant="default"
          disabled={liveTestMutation.isPending || livePreview?.providerConfigured === false}
          onClick={() => {
            const phone = livePreview?.phone || LIVE_TEST_FALLBACK.phone;
            const message = livePreview?.message || LIVE_TEST_FALLBACK.message;
            const ok = window.confirm(
              `לשלוח SMS אמיתי אחד?\n\nיעד: ${phone}\n\nהודעה:\n${message}\n\nקבלה אצל הספק אינה מאשרת מסירה לטלפון.`
            );
            if (!ok) return;
            setLiveTestResult(null);
            liveTestMutation.mutate();
          }}
        >
          {liveTestMutation.isPending ? "שולח…" : "שליחת SMS אמיתי לבדיקה"}
        </Button>

        {liveTestResult ? (
          <div
            className={`rounded-lg border px-3 py-3 text-sm space-y-1 ${
              liveTestResult.accepted
                ? "border-green-300 bg-green-50 text-green-900"
                : "border-destructive/30 bg-destructive/5 text-destructive"
            }`}
          >
            <p className="font-semibold">
              {liveTestResult.accepted
                ? "התקבל אצל הספק (status 0)"
                : "נכשל / לא התקבל אצל הספק"}
            </p>
            <p>{liveTestResult.note || liveTestResult.message || liveTestResult.error}</p>
            {liveTestResult.accepted ? (
              <p className="text-xs opacity-90">שים לב: קבלה אצל הספק ≠ מסירה לטלפון.</p>
            ) : null}
            {liveTestResult.status != null ? (
              <div className="font-mono text-xs" dir="ltr">
                provider status: {String(liveTestResult.status)}
              </div>
            ) : null}
            {liveTestResult.shipmentId ? (
              <div className="font-mono text-xs" dir="ltr">
                shipment: {liveTestResult.shipmentId}
              </div>
            ) : null}
            {liveTestResult.providerMessage ? (
              <div className="text-xs" dir="ltr">
                provider message: {liveTestResult.providerMessage}
              </div>
            ) : null}
            {liveTestResult.error && !liveTestResult.accepted ? (
              <div className="text-xs font-mono" dir="ltr">
                error: {liveTestResult.error}
              </div>
            ) : null}
            {liveTestResult.retryAfterSec ? (
              <div className="text-xs">נסו שוב בעוד {liveTestResult.retryAfterSec} שניות</div>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b p-5">
          <h3 className="text-lg font-semibold">היסטוריית שליחות SMS</h3>
          <p className="mt-1 text-sm text-muted-foreground">סטטוס אחרון לכל תור עם ניסיון SMS (כולל שגיאות).</p>
        </div>
        {historyLoading ? (
          <div className="p-5">
            <Skeleton className="h-32 rounded-lg" />
          </div>
        ) : historyError ? (
          <p className="p-5 text-sm text-destructive">{historyError.message}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-right text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {["שם", "טלפון", "תאריך", "שעה", "סטטוס SMS", "שגיאה", "Shipment"].map((h) => (
                    <th key={h} className="p-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-3">{row.patient_name}</td>
                    <td className="p-3 tabular-nums" dir="ltr">
                      {row.patient_phone}
                    </td>
                    <td className="p-3 tabular-nums">{row.date}</td>
                    <td className="p-3 tabular-nums">{row.time}</td>
                    <td className="p-3">{smsStatusLabel(row.reminder_sms_status)}</td>
                    <td className="p-3 text-xs text-muted-foreground max-w-[180px] truncate">
                      {row.reminder_sms_last_error || "—"}
                    </td>
                    <td className="p-3 font-mono text-xs" dir="ltr">
                      {row.reminder_sms_shipment_id || "—"}
                    </td>
                  </tr>
                ))}
                {!history.length ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-muted-foreground">
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
