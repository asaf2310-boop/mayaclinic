import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Navbar from "@/components/layout/Navbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { ArrowRight, Loader2, Mail, Phone, Save } from "lucide-react";
import { ContactChannelIcon } from "@/lib/contactIcons";
import { base44 } from "@/api/base44Client";
import { buildCustomers, buildWhatsAppUrl, formatDate, statusMeta } from "@/lib/customers";
import { filterAppointmentsForClinic, getClinicSite } from "@/lib/clinicSite";
import {
  FUNDING_SOURCE_OPTIONS,
  GENDER_OPTIONS,
  HMO_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  PATIENT_TYPE_OPTIONS,
  PREFERRED_CONTACT_OPTIONS,
  SESSION_LOCATION_OPTIONS,
  emptyPatientProfileFields,
  fetchPatientProfile,
  normalizeProfileFields,
  savePatientProfile,
} from "@/lib/patientProfiles";
import {
  clinicFormInput,
  clinicFormLabel,
  clinicGlassCard,
  clinicOutlineBtn,
  clinicPageGradient,
  clinicPrimaryBtn,
  clinicTextHeading,
} from "@/lib/clinicUi";

function ProfileField({ label, children, className = "" }) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label className={clinicFormLabel}>{label}</Label>
      {children}
    </div>
  );
}

function ProfileSelect({ label, value, onValueChange, options, placeholder }) {
  return (
    <ProfileField label={label}>
      <Select value={value || undefined} onValueChange={onValueChange}>
        <SelectTrigger className={clinicFormInput}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent dir="rtl">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </ProfileField>
  );
}

export default function AdminPatient() {
  const clinicSite = getClinicSite();
  const { patientKey = "" } = useParams();
  const decodedKey = decodeURIComponent(patientKey);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState(emptyPatientProfileFields());

  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery({
    queryKey: ["appointments"],
    queryFn: () => base44.entities.Appointment.list("date"),
  });

  const clinicAppointments = useMemo(
    () => filterAppointmentsForClinic(appointments, clinicSite),
    [appointments, clinicSite]
  );

  const customer = useMemo(() => {
    const customers = buildCustomers(clinicAppointments);
    return customers.find((item) => item.key === decodedKey) || null;
  }, [clinicAppointments, decodedKey]);

  const { data: profileRow, isLoading: profileLoading } = useQuery({
    queryKey: ["patient-profile", decodedKey],
    queryFn: () => fetchPatientProfile(decodedKey),
    enabled: Boolean(decodedKey),
  });

  useEffect(() => {
    setForm(normalizeProfileFields(profileRow?.profile));
  }, [profileRow]);

  const saveMutation = useMutation({
    mutationFn: () => savePatientProfile(decodedKey, customer, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-profile", decodedKey] });
      queryClient.invalidateQueries({ queryKey: ["patient-profiles"] });
      toast({ title: "נשמר", description: "פרטי המטופל עודכנו בהצלחה." });
    },
    onError: () => {
      toast({
        title: "שגיאה בשמירה",
        description: "לא הצלחנו לשמור את פרטי המטופל. נסו שוב.",
        variant: "destructive",
      });
    },
  });

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const isLoading = appointmentsLoading || profileLoading;

  if (isLoading) {
    return (
      <div className={`min-h-screen ${clinicSite ? `${clinicPageGradient} clinic-page-enter` : "bg-background"}`}>
        <Navbar />
        <main className="px-6 pb-16 pt-24" dir="rtl">
          <div className="mx-auto max-w-6xl space-y-4">
            <Skeleton className="h-12 w-60 rounded-xl" />
            <Skeleton className="h-96 rounded-xl" />
          </div>
        </main>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className={`min-h-screen ${clinicSite ? `${clinicPageGradient} clinic-page-enter` : "bg-background"}`}>
        <Navbar />
        <main className="px-6 pb-16 pt-24" dir="rtl">
          <div className="mx-auto max-w-3xl">
            <Card className="p-8 text-center">
              <h1 className="text-2xl font-bold">מטופל לא נמצא</h1>
              <p className="mt-2 text-muted-foreground">ייתכן שהמזהה אינו תקין או שאין תורים עבור המטופל.</p>
              <Button asChild className={`mt-6 ${clinicSite ? clinicPrimaryBtn : ""}`}>
                <Link to="/admin">חזרה לניהול</Link>
              </Button>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  const whatsappUrl = buildWhatsAppUrl(customer.phone);
  const mailtoUrl = customer.email
    ? `mailto:${customer.email}?subject=${encodeURIComponent(`עדכון מ${clinicSite?.clinicTitle ?? "הקליניקה"}`)}`
    : null;
  const cardClass = clinicSite ? clinicGlassCard : "";
  const inputClass = clinicSite ? clinicFormInput : "";

  return (
    <div className={`min-h-screen ${clinicSite ? `${clinicPageGradient} clinic-page-enter` : "bg-background"}`}>
      <Navbar />
      <main className="relative px-6 pb-16 pt-24" dir="rtl">
        <div className="relative mx-auto max-w-6xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className={`text-3xl font-bold ${clinicSite ? clinicTextHeading : ""}`}>{customer.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">תיק מטופל — מגע שיקומי</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className={clinicSite ? clinicPrimaryBtn : ""}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="ms-2 h-4 w-4" />
                )}
                שמירת תיק
              </Button>
              <Button asChild variant="outline" className={clinicSite ? `${clinicOutlineBtn} !px-4 !py-2` : ""}>
                <Link to="/admin" className="inline-flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  חזרה לניהול
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Card className={`p-4 ${cardClass}`}>
              <p className="text-xs text-muted-foreground">סה"כ טיפולים שהושלמו</p>
              <p className="text-2xl font-bold">{customer.completedAppointmentsCount}</p>
            </Card>
            <Card className={`p-4 ${cardClass}`}>
              <p className="text-xs text-muted-foreground">תורים פעילים</p>
              <p className="text-2xl font-bold">{customer.activeAppointmentsCount}</p>
            </Card>
            <Card className={`p-4 ${cardClass}`}>
              <p className="text-xs text-muted-foreground">סה"כ תורים</p>
              <p className="text-2xl font-bold">{customer.appointments.length}</p>
            </Card>
            <Card className={`p-4 ${cardClass}`}>
              <p className="text-xs text-muted-foreground">הכנסות ששולמו</p>
              <p className="text-2xl font-bold">₪{customer.totalRevenue.toLocaleString("he-IL")}</p>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              <Card className={`p-5 ${cardClass}`}>
                <h2 className="mb-4 text-lg font-semibold">פרטים אישיים</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <ProfileSelect
                    label="מגדר"
                    value={form.gender}
                    onValueChange={(value) => setField("gender", value)}
                    options={GENDER_OPTIONS}
                    placeholder="בחר/י מגדר"
                  />
                  <ProfileSelect
                    label="מצב משפחתי"
                    value={form.maritalStatus}
                    onValueChange={(value) => setField("maritalStatus", value)}
                    options={MARITAL_STATUS_OPTIONS}
                    placeholder="בחר/י מצב"
                  />
                  <ProfileField label="תאריך לידה">
                    <Input
                      type="date"
                      value={form.birthDate}
                      onChange={(event) => setField("birthDate", event.target.value)}
                      className={inputClass}
                    />
                  </ProfileField>
                  <ProfileField label="עיסוק">
                    <Input
                      value={form.occupation}
                      onChange={(event) => setField("occupation", event.target.value)}
                      placeholder="לדוגמה: מורה, מהנדס/ת"
                      className={inputClass}
                    />
                  </ProfileField>
                  <ProfileSelect
                    label="סוג מטופל"
                    value={form.patientType}
                    onValueChange={(value) => setField("patientType", value)}
                    options={PATIENT_TYPE_OPTIONS}
                    placeholder="בחר/י סוג"
                  />
                  <ProfileSelect
                    label="קופת חולים"
                    value={form.hmo}
                    onValueChange={(value) => setField("hmo", value)}
                    options={HMO_OPTIONS}
                    placeholder="בחר/י קופה"
                  />
                  <ProfileField label="ביטוח משלים" className="sm:col-span-2">
                    <Input
                      value={form.insurance}
                      onChange={(event) => setField("insurance", event.target.value)}
                      placeholder="שם חברת ביטוח / פוליסה (אופציונלי)"
                      className={inputClass}
                    />
                  </ProfileField>
                </div>
              </Card>

              <Card className={`p-5 ${cardClass}`}>
                <h2 className="mb-4 text-lg font-semibold">פרטי קשר</h2>
                <div className="mb-4 rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
                  <p className="font-medium">{customer.name}</p>
                  <p className="mt-1 text-muted-foreground">{customer.phone || "אין טלפון"}</p>
                  <p className="text-muted-foreground" dir="ltr">
                    {customer.email || "אין אימייל"}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    פרטי קשר מעודכנים מתורים. לעריכה — עדכנו בתור הבא.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ProfileField label="עיר">
                    <Input
                      value={form.city}
                      onChange={(event) => setField("city", event.target.value)}
                      className={inputClass}
                    />
                  </ProfileField>
                  <ProfileField label="מיקוד">
                    <Input
                      value={form.zip}
                      onChange={(event) => setField("zip", event.target.value)}
                      className={inputClass}
                    />
                  </ProfileField>
                  <ProfileField label="כתובת" className="sm:col-span-2">
                    <Input
                      value={form.address}
                      onChange={(event) => setField("address", event.target.value)}
                      className={inputClass}
                    />
                  </ProfileField>
                  <ProfileSelect
                    label="אמצעי קשר מועדף"
                    value={form.preferredContact}
                    onValueChange={(value) => setField("preferredContact", value)}
                    options={PREFERRED_CONTACT_OPTIONS}
                    placeholder="בחר/י אמצעי"
                  />
                  <ProfileField label="איש קשר לחירום — שם">
                    <Input
                      value={form.emergencyContactName}
                      onChange={(event) => setField("emergencyContactName", event.target.value)}
                      className={inputClass}
                    />
                  </ProfileField>
                  <ProfileField label="איש קשר לחירום — טלפון">
                    <Input
                      value={form.emergencyContactPhone}
                      onChange={(event) => setField("emergencyContactPhone", event.target.value)}
                      className={inputClass}
                      dir="ltr"
                    />
                  </ProfileField>
                </div>
              </Card>

              <Card className={`p-5 ${cardClass}`}>
                <h2 className="mb-4 text-lg font-semibold">רקע רפואי / טיפולי</h2>
                <ProfileField label="רקע קל (אלרגיות, טיפולים קודמים, מגבלות)">
                  <Textarea
                    value={form.medicalBackground}
                    onChange={(event) => setField("medicalBackground", event.target.value)}
                    rows={4}
                    placeholder="מידע רלוונטי לטיפול — לא תיק רפואי מלא"
                    className={inputClass}
                  />
                </ProfileField>
              </Card>

              <Card className={`p-5 ${cardClass}`}>
                <h2 className="mb-4 text-lg font-semibold">הערות מטפל</h2>
                <div className="grid gap-4">
                  <ProfileField label="הערות קליטה">
                    <Textarea
                      value={form.intakeNotes}
                      onChange={(event) => setField("intakeNotes", event.target.value)}
                      rows={3}
                      placeholder="סיבת הפנייה, ציפיות, הקשר ראשוני"
                      className={inputClass}
                    />
                  </ProfileField>
                  <ProfileField label="מטרות טיפול">
                    <Textarea
                      value={form.treatmentGoals}
                      onChange={(event) => setField("treatmentGoals", event.target.value)}
                      rows={3}
                      placeholder="מטרות לטווח קצר וארוך"
                      className={inputClass}
                    />
                  </ProfileField>
                  <ProfileField label="הערות מתמשכות">
                    <Textarea
                      value={form.continuousNotes}
                      onChange={(event) => setField("continuousNotes", event.target.value)}
                      rows={5}
                      placeholder="תיעוד שוטף — התקדמות, תצפיות, המלצות"
                      className={inputClass}
                    />
                  </ProfileField>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ProfileSelect
                      label="מיקום מפגש"
                      value={form.sessionLocation}
                      onValueChange={(value) => setField("sessionLocation", value)}
                      options={SESSION_LOCATION_OPTIONS}
                      placeholder="בחר/י מיקום"
                    />
                    <ProfileField label="זמנים מועדפים">
                      <Input
                        value={form.preferredTimes}
                        onChange={(event) => setField("preferredTimes", event.target.value)}
                        placeholder="לדוגמה: בוקר, ימי ראשון"
                        className={inputClass}
                      />
                    </ProfileField>
                  </div>
                </div>
              </Card>

              <Card className={`p-5 ${cardClass}`}>
                <h2 className="mb-1 text-lg font-semibold">מימון</h2>
                <p className="mb-4 text-sm text-muted-foreground">אופציונלי — לניהול פנימי בקליניקה</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ProfileSelect
                    label="מקור מימון"
                    value={form.fundingSource}
                    onValueChange={(value) => setField("fundingSource", value)}
                    options={FUNDING_SOURCE_OPTIONS}
                    placeholder="בחר/י מקור"
                  />
                  <ProfileField label="מחיר למפגש (₪)">
                    <Input
                      type="number"
                      min="0"
                      value={form.sessionPrice}
                      onChange={(event) => setField("sessionPrice", event.target.value)}
                      placeholder="320"
                      className={inputClass}
                    />
                  </ProfileField>
                </div>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className={`p-4 ${cardClass}`}>
                <p className="mb-3 text-sm font-semibold">פרטי קשר מהירים</p>
                <div className="space-y-2 text-sm">
                  <p className="inline-flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {customer.phone || "אין טלפון"}
                  </p>
                  <p className="inline-flex items-center gap-2" dir="ltr">
                    <Mail className="h-4 w-4" />
                    {customer.email || "אין אימייל"}
                  </p>
                </div>
                <div className="mt-3">
                  <Badge variant={customer.marketingConsent ? "default" : "secondary"}>
                    {customer.marketingConsent ? "אישר/ה דיוור" : "לא אישר/ה דיוור"}
                  </Badge>
                </div>
              </Card>

              <Card className={`p-4 ${cardClass}`}>
                <p className="mb-3 text-sm font-semibold">פעולות</p>
                <div className="space-y-2">
                  {mailtoUrl ? (
                    <Button asChild variant="outline" className={`w-full justify-start gap-2 ${clinicSite ? `${clinicOutlineBtn} !px-4 !py-3` : ""}`}>
                      <a href={mailtoUrl}>
                        <Mail className="h-4 w-4" />
                        שליחת אימייל
                      </a>
                    </Button>
                  ) : (
                    <Button disabled variant="outline" className={`w-full justify-start gap-2 ${clinicSite ? `${clinicOutlineBtn} !px-4 !py-3` : ""}`}>
                      <Mail className="h-4 w-4" />
                      אין אימייל
                    </Button>
                  )}
                  {whatsappUrl ? (
                    <Button asChild variant="outline" className={`w-full justify-start gap-2 ${clinicSite ? `${clinicOutlineBtn} !px-4 !py-3` : ""}`}>
                      <a href={whatsappUrl} target="_blank" rel="noreferrer">
                        <ContactChannelIcon channel="whatsapp" size="sm" decorative />
                        שליחה בוואטסאפ
                      </a>
                    </Button>
                  ) : (
                    <Button disabled variant="outline" className={`w-full justify-start gap-2 ${clinicSite ? `${clinicOutlineBtn} !px-4 !py-3` : ""}`}>
                      <ContactChannelIcon channel="whatsapp" size="sm" decorative />
                      אין טלפון
                    </Button>
                  )}
                </div>
              </Card>

              <Card className={`p-4 ${cardClass}`}>
                <p className="mb-3 text-sm font-semibold">היסטוריית טיפולים</p>
                <div className="max-h-80 space-y-2 overflow-y-auto">
                  {customer.appointments.map((appointment) => {
                    const meta = statusMeta(appointment.status, appointment.paid);
                    return (
                      <div key={appointment.id} className="rounded-xl border border-border/60 p-3 text-sm">
                        <p className="font-medium">{appointment.treatment_name || "-"}</p>
                        <p className="mt-1 tabular-nums text-muted-foreground">
                          {formatDate(appointment.date)} {appointment.time || ""}
                        </p>
                        <span className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-medium ${meta.className}`}>
                          {meta.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {customer.notes ? (
                <Card className={`p-4 ${cardClass}`}>
                  <p className="mb-2 text-sm font-semibold">הערות מהזמנה</p>
                  <p className="text-sm text-muted-foreground">{customer.notes}</p>
                </Card>
              ) : null}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
