import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, isValid, parseISO, startOfDay, startOfMonth } from "date-fns";
import { he } from "date-fns/locale";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Phone,
  XCircle,
} from "lucide-react";
import Navbar from "../components/layout/Navbar";
import BookingCalendar from "@/components/booking/BookingCalendar";
import TimeSlotSelector from "@/components/booking/TimeSlotSelector";
import BookingContact from "@/components/booking/BookingContact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { base44 } from "@/api/base44Client";
import { bookingBasePath } from "@/lib/bookingMount";
import {
  filterAppointmentsForClinic,
  filterByClinicTenant,
  getClinicSite,
} from "@/lib/clinicSite";
import {
  clinicBookPageSubtitle,
  clinicBookPageTitle,
  clinicFadeIn,
  clinicFormInput,
  clinicFormLabel,
  clinicGlassCard,
  clinicGlassPanel,
  clinicOutlineBtn,
  clinicPageGradient,
  clinicPrimaryBtn,
  clinicTextHeading,
  clinicTextMuted,
  clinicTextPrimary,
} from "@/lib/clinicUi";
import {
  countAvailableSlotsByDate,
  filterAvailableSlots,
} from "@/lib/bookingSlots";
import {
  cancelSelfServiceAppointment,
  clearSelfServiceSession,
  listSelfServiceAppointments,
  loadSelfServiceSession,
  requestSelfServiceOtp,
  rescheduleSelfServiceAppointment,
  saveSelfServiceSession,
  verifySelfServiceOtp,
} from "@/lib/selfServiceApi";

const POLICY_MESSAGE =
  "ניתן לעדכן או לבטל תור עד 24 שעות לפני מועד התור. לשינוי בשלב זה יש ליצור קשר עם בית העסק.";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatDateHe(iso) {
  try {
    const parsed = parseISO(String(iso));
    if (!isValid(parsed)) return String(iso || "");
    return format(parsed, "dd/MM/yyyy", { locale: he });
  } catch {
    return String(iso || "");
  }
}

function AppointmentCard({ appointment, selected, onSelect }) {
  const clinicSite = getClinicSite();
  return (
    <button
      type="button"
      onClick={() => onSelect?.(appointment)}
      className={`w-full rounded-2xl border p-4 text-right transition ${
        selected
          ? "border-[var(--ofir-5d7f6d,#5D7F6D)] bg-[var(--ofir-f7faf8,#F7FAF8)]"
          : clinicSite
            ? "border-[var(--ofir-e8ece8,#E8ECE8)] bg-white/70 hover:border-[#C9D5CC]"
            : "border-border bg-card hover:bg-muted/40"
      }`}
    >
      <div className={`text-lg font-bold ${clinicSite ? clinicTextHeading : ""}`}>
        {appointment.treatment_name || "טיפול"}
      </div>
      <div className={`mt-2 text-sm ${clinicSite ? clinicTextMuted : "text-muted-foreground"}`}>
        {formatDateHe(appointment.date)} · {appointment.time}
        {appointment.duration_minutes ? ` · ${appointment.duration_minutes} דק׳` : ""}
      </div>
      {appointment.therapist_names ? (
        <div className={`mt-1 text-sm ${clinicSite ? clinicTextMuted : "text-muted-foreground"}`}>
          מטפל/ת: {appointment.therapist_names}
        </div>
      ) : null}
      {!appointment.can_modify ? (
        <p className={`mt-3 text-xs leading-relaxed ${clinicSite ? clinicTextMuted : "text-muted-foreground"}`}>
          {appointment.policy_message || POLICY_MESSAGE}
        </p>
      ) : null}
    </button>
  );
}

export default function ManageAppointment() {
  const clinicSite = getClinicSite();
  const clinicPhone = clinicSite?.clinicPhone || "0549000301";

  const [step, setStep] = useState("phone"); // phone | otp | list | detail | reschedule | confirmReschedule | confirmCancel | done
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [doneKind, setDoneKind] = useState(""); // reschedule | cancel
  const [previousSlot, setPreviousSlot] = useState(null);
  const [resultAppointment, setResultAppointment] = useState(null);

  useEffect(() => {
    const existing = loadSelfServiceSession();
    if (!existing?.token) return;
    setSessionToken(existing.token);
    setPhone(existing.phone || "");
    setBusy(true);
    listSelfServiceAppointments(existing.token)
      .then((data) => {
        setAppointments(data.appointments || []);
        setStep("list");
      })
      .catch(() => {
        clearSelfServiceSession();
        setSessionToken("");
      })
      .finally(() => setBusy(false));
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = window.setTimeout(() => setResendIn((v) => Math.max(0, v - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const durationMinutes = Number(selected?.duration_minutes) || 60;

  const {
    data: availabilityRecordsRaw = [],
  } = useQuery({
    queryKey: ["availability", "self-service"],
    queryFn: () => base44.entities.Availability.list(),
    enabled: step === "reschedule" || step === "confirmReschedule",
  });

  const {
    data: appointmentsRaw = [],
  } = useQuery({
    queryKey: ["appointments-public", "self-service"],
    queryFn: () => base44.entities.Appointment.list(),
    enabled: step === "reschedule" || step === "confirmReschedule",
  });

  const availabilityRecords = useMemo(
    () => filterByClinicTenant(asArray(availabilityRecordsRaw), clinicSite),
    [availabilityRecordsRaw, clinicSite]
  );

  const publicAppointments = useMemo(
    () => filterAppointmentsForClinic(asArray(appointmentsRaw), clinicSite),
    [appointmentsRaw, clinicSite]
  );

  const appointmentsByDate = useMemo(() => {
    const map = {};
    for (const apt of publicAppointments) {
      if (!apt?.date) continue;
      if (!map[apt.date]) map[apt.date] = [];
      map[apt.date].push(apt);
    }
    return map;
  }, [publicAppointments]);

  const slotCountByDate = useMemo(
    () =>
      countAvailableSlotsByDate(availabilityRecords, appointmentsByDate, {
        bookingDurationMinutes: durationMinutes,
      }),
    [availabilityRecords, appointmentsByDate, durationMinutes]
  );

  const selectedDaySlots = useMemo(() => {
    if (!newDate) return [];
    const record = availabilityRecords.find((row) => row.date === newDate && row.is_active);
    const dayAppointments = (appointmentsByDate[newDate] || []).filter(
      (apt) => String(apt.id) !== String(selected?.id)
    );
    return filterAvailableSlots(record?.slots || [], dayAppointments, {
      bookingDurationMinutes: durationMinutes,
    });
  }, [availabilityRecords, appointmentsByDate, newDate, selected?.id, durationMinutes]);

  const isDateAvailable = (dateObj) => {
    const iso = format(dateObj, "yyyy-MM-dd");
    if (isValid(dateObj) && dateObj < startOfDay(new Date())) return false;
    return (slotCountByDate[iso] || 0) > 0;
  };

  async function handleRequestOtp(e) {
    e?.preventDefault?.();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      const result = await requestSelfServiceOtp(phone);
      setInfo(result.message || "נשלח קוד אימות");
      setResendIn(Number(result.resendAfterSec) || 60);
      if (result.bypass && result.debugCode) {
        setOtp(String(result.debugCode));
        setInfo(`${result.message} (מצב פיתוח: ${result.debugCode})`);
      }
      setStep("otp");
    } catch (err) {
      setError(err?.message || "לא ניתן לשלוח קוד");
      if (err?.payload?.retryAfterSec) setResendIn(Number(err.payload.retryAfterSec) || 60);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp(e) {
    e?.preventDefault?.();
    setError("");
    setBusy(true);
    try {
      const result = await verifySelfServiceOtp(phone, otp);
      setSessionToken(result.sessionToken);
      saveSelfServiceSession({ token: result.sessionToken, phone });
      setAppointments(result.appointments || []);
      setSelected(null);
      setStep("list");
      if (result.empty) setInfo(result.message || "לא נמצאו תורים קרובים");
      else setInfo("");
    } catch (err) {
      setError(err?.message || "קוד שגוי");
    } finally {
      setBusy(false);
    }
  }

  async function refreshList() {
    if (!sessionToken) return;
    const data = await listSelfServiceAppointments(sessionToken);
    setAppointments(data.appointments || []);
  }

  async function handleConfirmReschedule() {
    if (!selected || !sessionToken || !newDate || !newTime) return;
    setBusy(true);
    setError("");
    try {
      const result = await rescheduleSelfServiceAppointment({
        sessionToken,
        appointmentId: selected.id,
        date: newDate,
        time: newTime,
        updated_at: selected.updated_at,
      });
      setPreviousSlot(result.previous || { date: selected.date, time: selected.time });
      setResultAppointment(result.appointment);
      setDoneKind("reschedule");
      setStep("done");
      await refreshList().catch(() => {});
    } catch (err) {
      setError(err?.message || "לא ניתן לעדכן את התור");
      if (err?.code === "concurrent_modification" || err?.code === "slot_taken") {
        try {
          await refreshList();
        } catch {
          /* ignore */
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmCancel() {
    if (!selected || !sessionToken) return;
    setBusy(true);
    setError("");
    try {
      const result = await cancelSelfServiceAppointment({
        sessionToken,
        appointmentId: selected.id,
        updated_at: selected.updated_at,
      });
      setPreviousSlot(result.previous || { date: selected.date, time: selected.time });
      setResultAppointment(result.appointment);
      setDoneKind("cancel");
      setStep("done");
      await refreshList().catch(() => {});
    } catch (err) {
      setError(err?.message || "לא ניתן לבטל את התור");
    } finally {
      setBusy(false);
    }
  }

  function resetFlow() {
    clearSelfServiceSession();
    setSessionToken("");
    setAppointments([]);
    setSelected(null);
    setPhone("");
    setOtp("");
    setStep("phone");
    setError("");
    setInfo("");
    setDoneKind("");
    setResultAppointment(null);
    setPreviousSlot(null);
  }

  const shellClass = clinicSite
    ? `page-background ${clinicPageGradient} clinic-page-enter font-sans`
    : "bg-background";

  return (
    <div className={`min-h-screen overflow-x-hidden ${shellClass}`}>
      <Navbar />
      <main className="relative px-4 pb-12 pt-20 sm:px-6 sm:pb-16 sm:pt-24" dir="rtl">
        <div className={`relative mx-auto w-full max-w-2xl ${clinicSite ? clinicFadeIn : ""}`}>
          <div className="mb-8 text-center">
            <h1 className={clinicSite ? clinicBookPageTitle : "mb-3 text-3xl font-bold tracking-tight"}>
              עדכון או ביטול תור
            </h1>
            <p className={clinicSite ? clinicBookPageSubtitle : "text-muted-foreground"}>
              אימות באמצעות קוד SMS למספר הנייד שאיתו נקבע התור
            </p>
          </div>

          <div className={`space-y-6 ${clinicSite ? clinicGlassPanel : ""}`}>
            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
                {error}
                {/24 שעות/.test(error) ? (
                  <div className="mt-2">
                    <a className={`underline ${clinicTextPrimary}`} href={`tel:${clinicPhone}`}>
                      יצירת קשר: {clinicPhone}
                    </a>
                  </div>
                ) : null}
              </div>
            ) : null}
            {info ? (
              <div className="rounded-xl border border-[#D5E0D8] bg-[#F7FAF8] px-4 py-3 text-sm text-[#2F3E35]">
                {info}
              </div>
            ) : null}

            {step === "phone" ? (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <Label className={clinicSite ? clinicFormLabel : ""} htmlFor="ss-phone">
                    מספר נייד
                  </Label>
                  <Input
                    id="ss-phone"
                    dir="ltr"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="05XXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={clinicSite ? clinicFormInput : ""}
                    required
                  />
                </div>
                <Button type="submit" disabled={busy || !phone.trim()} className={`w-full gap-2 ${clinicSite ? clinicPrimaryBtn : ""}`}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                  שליחת קוד אימות
                </Button>
              </form>
            ) : null}

            {step === "otp" ? (
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <p className={`text-sm ${clinicSite ? clinicTextMuted : "text-muted-foreground"}`}>
                  הזינו את הקוד שנשלח ל־{phone}
                </p>
                <div className="flex justify-center" dir="ltr">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                      {[0, 1, 2, 3, 4, 5].map((index) => (
                        <InputOTPSlot key={index} index={index} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button
                  type="submit"
                  disabled={busy || otp.replace(/\D/g, "").length !== 6}
                  className={`w-full ${clinicSite ? clinicPrimaryBtn : ""}`}
                >
                  {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "אימות והצגת תורים"}
                </Button>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || resendIn > 0}
                    onClick={handleRequestOtp}
                    className={`flex-1 ${clinicSite ? clinicOutlineBtn : ""}`}
                  >
                    {resendIn > 0 ? `שליחה מחדש בעוד ${resendIn} שנ׳` : "שליחה מחדש"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setStep("phone");
                      setOtp("");
                      setError("");
                    }}
                    className="flex-1"
                  >
                    שינוי מספר
                  </Button>
                </div>
              </form>
            ) : null}

            {step === "list" ? (
              <div className="space-y-4">
                {appointments.length === 0 ? (
                  <div className={`rounded-2xl p-6 text-center ${clinicSite ? clinicGlassCard : "bg-muted/40"}`}>
                    <p className={clinicSite ? clinicTextHeading : "font-medium"}>לא נמצאו תורים קרובים</p>
                    <p className={`mt-2 text-sm ${clinicSite ? clinicTextMuted : "text-muted-foreground"}`}>
                      אם נקבע תור לאחרונה, ודאו שהמספר זהה לזה שבמערכת.
                    </p>
                  </div>
                ) : (
                  appointments.map((apt) => (
                    <AppointmentCard
                      key={apt.id}
                      appointment={apt}
                      selected={selected?.id === apt.id}
                      onSelect={(item) => {
                        setSelected(item);
                        setStep("detail");
                        setError("");
                      }}
                    />
                  ))
                )}
                <Button type="button" variant="outline" className={`w-full ${clinicSite ? clinicOutlineBtn : ""}`} onClick={resetFlow}>
                  התנתקות
                </Button>
              </div>
            ) : null}

            {step === "detail" && selected ? (
              <div className="space-y-4">
                <button
                  type="button"
                  className={`inline-flex items-center gap-1 text-sm ${clinicSite ? clinicTextPrimary : "text-primary"}`}
                  onClick={() => {
                    setStep("list");
                    setError("");
                  }}
                >
                  <ArrowRight className="h-4 w-4" />
                  חזרה לרשימה
                </button>
                <div className={`rounded-2xl p-5 ${clinicSite ? clinicGlassCard : "bg-muted/40"}`}>
                  <div className={`text-xl font-bold ${clinicSite ? clinicTextHeading : ""}`}>
                    {selected.treatment_name}
                  </div>
                  <div className={`mt-3 space-y-1 text-sm ${clinicSite ? clinicTextMuted : "text-muted-foreground"}`}>
                    <div>תאריך: {formatDateHe(selected.date)}</div>
                    <div>שעה: {selected.time}</div>
                    {selected.duration_minutes ? <div>משך: {selected.duration_minutes} דקות</div> : null}
                    {selected.therapist_names ? <div>מטפל/ת: {selected.therapist_names}</div> : null}
                  </div>
                </div>

                {!selected.can_modify ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                    <p>{selected.policy_message || POLICY_MESSAGE}</p>
                    <p className="mt-2">
                      טלפון העסק:{" "}
                      <a className="underline" href={`tel:${selected.clinic_phone || clinicPhone}`}>
                        {selected.clinic_phone || clinicPhone}
                      </a>
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      type="button"
                      className={`flex-1 gap-2 ${clinicSite ? clinicPrimaryBtn : ""}`}
                      onClick={() => {
                        setNewDate("");
                        setNewTime("");
                        setStep("reschedule");
                        setError("");
                      }}
                    >
                      <CalendarClock className="h-4 w-4" />
                      שינוי מועד
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={`flex-1 gap-2 ${clinicSite ? clinicOutlineBtn : ""}`}
                      onClick={() => {
                        setStep("confirmCancel");
                        setError("");
                      }}
                    >
                      <XCircle className="h-4 w-4" />
                      ביטול תור
                    </Button>
                  </div>
                )}
              </div>
            ) : null}

            {step === "reschedule" && selected ? (
              <div className="space-y-5">
                <button
                  type="button"
                  className={`inline-flex items-center gap-1 text-sm ${clinicSite ? clinicTextPrimary : "text-primary"}`}
                  onClick={() => setStep("detail")}
                >
                  <ArrowRight className="h-4 w-4" />
                  חזרה
                </button>
                <p className={`text-sm ${clinicSite ? clinicTextMuted : "text-muted-foreground"}`}>
                  בחרו מועד חדש לטיפול «{selected.treatment_name}». המועד הנוכחי: {formatDateHe(selected.date)} · {selected.time}
                </p>
                <BookingCalendar
                  viewMonth={viewMonth}
                  onViewMonthChange={setViewMonth}
                  selectedDate={newDate ? parseISO(newDate) : null}
                  onDateSelect={(dateObj) => {
                    setNewDate(format(dateObj, "yyyy-MM-dd"));
                    setNewTime("");
                  }}
                  slotCountByDate={slotCountByDate}
                  isDateAvailable={isDateAvailable}
                  selectedDaySlotCount={selectedDaySlots.length}
                />
                {newDate ? (
                  <TimeSlotSelector
                    slots={selectedDaySlots}
                    selectedSlot={newTime}
                    onSelect={setNewTime}
                  />
                ) : null}
                <Button
                  type="button"
                  disabled={!newDate || !newTime}
                  className={`w-full ${clinicSite ? clinicPrimaryBtn : ""}`}
                  onClick={() => setStep("confirmReschedule")}
                >
                  המשך לאישור
                </Button>
              </div>
            ) : null}

            {step === "confirmReschedule" && selected ? (
              <div className="space-y-4">
                <div className={`rounded-2xl p-5 ${clinicSite ? clinicGlassCard : "bg-muted/40"}`}>
                  <p className={`font-bold ${clinicSite ? clinicTextHeading : ""}`}>אישור עדכון תור</p>
                  <div className={`mt-3 grid gap-3 text-sm ${clinicSite ? clinicTextMuted : "text-muted-foreground"}`}>
                    <div>
                      <span className="font-medium text-foreground">מועד נוכחי:</span>{" "}
                      {formatDateHe(selected.date)} · {selected.time}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">מועד חדש:</span>{" "}
                      {formatDateHe(newDate)} · {newTime}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">טיפול:</span> {selected.treatment_name}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="button"
                    disabled={busy}
                    className={`flex-1 ${clinicSite ? clinicPrimaryBtn : ""}`}
                    onClick={handleConfirmReschedule}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "אישור עדכון"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    className={`flex-1 ${clinicSite ? clinicOutlineBtn : ""}`}
                    onClick={() => setStep("reschedule")}
                  >
                    חזרה
                  </Button>
                </div>
              </div>
            ) : null}

            {step === "confirmCancel" && selected ? (
              <div className="space-y-4">
                <div className={`rounded-2xl p-5 ${clinicSite ? clinicGlassCard : "bg-muted/40"}`}>
                  <p className={`font-bold ${clinicSite ? clinicTextHeading : ""}`}>אישור ביטול תור</p>
                  <p className={`mt-2 text-sm ${clinicSite ? clinicTextMuted : "text-muted-foreground"}`}>
                    האם לבטל את התור ל־{formatDateHe(selected.date)} בשעה {selected.time} ({selected.treatment_name})?
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="button"
                    disabled={busy}
                    variant="destructive"
                    className="flex-1"
                    onClick={handleConfirmCancel}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "כן, בטלו את התור"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    className={`flex-1 ${clinicSite ? clinicOutlineBtn : ""}`}
                    onClick={() => setStep("detail")}
                  >
                    לא, חזרה
                  </Button>
                </div>
              </div>
            ) : null}

            {step === "done" ? (
              <div className="space-y-5 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--ofir-5d7f6d,#5D7F6D)]/10">
                  <CheckCircle2 className={`h-8 w-8 ${clinicSite ? clinicTextPrimary : "text-primary"}`} />
                </div>
                <h2 className={`text-2xl font-bold ${clinicSite ? clinicTextHeading : ""}`}>
                  {doneKind === "cancel" ? "התור בוטל בהצלחה" : "התור עודכן בהצלחה"}
                </h2>
                {doneKind === "reschedule" && resultAppointment ? (
                  <p className={`text-sm ${clinicSite ? clinicTextMuted : "text-muted-foreground"}`}>
                    מ־{formatDateHe(previousSlot?.date)} {previousSlot?.time} ל־
                    {formatDateHe(resultAppointment.date)} {resultAppointment.time}
                  </p>
                ) : null}
                {doneKind === "cancel" ? (
                  <p className={`text-sm ${clinicSite ? clinicTextMuted : "text-muted-foreground"}`}>
                    המועד שוחרר. נשמח לראותך שוב.
                  </p>
                ) : null}
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <Button asChild className={clinicSite ? clinicPrimaryBtn : ""}>
                    <Link to={bookingBasePath ? "/book" : "/book"}>קביעת תור חדש</Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={clinicSite ? clinicOutlineBtn : ""}
                    onClick={() => {
                      setSelected(null);
                      setStep("list");
                      setError("");
                      setInfo("");
                    }}
                  >
                    חזרה לתורים שלי
                  </Button>
                </div>
              </div>
            ) : null}

            <BookingContact />
          </div>
        </div>
      </main>
    </div>
  );
}
