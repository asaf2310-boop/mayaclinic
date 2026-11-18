import React, { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Navbar from "@/components/layout/Navbar";
import PatientProfileForm from "@/components/admin/PatientProfileForm";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { ArrowRight, Loader2, Mail, Phone, Save } from "lucide-react";
import { ContactChannelIcon } from "@/lib/contactIcons";
import { base44 } from "@/api/base44Client";
import { buildCustomers, buildWhatsAppUrl, formatDate, statusMeta } from "@/lib/customers";
import { filterAppointmentsForClinic, getClinicSite } from "@/lib/clinicSite";
import { fetchPatientProfile, savePatientProfile } from "@/lib/patientProfiles";
import {
  clinicFormInput,
  clinicGlassCard,
  clinicOutlineBtn,
  clinicPageGradient,
  clinicPrimaryBtn,
  clinicTextHeading,
} from "@/lib/clinicUi";

const PATIENT_FORM_ID = "patient-profile-form";

export default function AdminPatient() {
  const clinicSite = getClinicSite();
  const { patientKey = "" } = useParams();
  const decodedKey = decodeURIComponent(patientKey);
  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  const saveMutation = useMutation({
    mutationFn: (form) => savePatientProfile(decodedKey, customer, form),
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
                type="submit"
                form={PATIENT_FORM_ID}
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
            <PatientProfileForm
              key={profileRow?.updated_at || profileRow?.id || decodedKey}
              formId={PATIENT_FORM_ID}
              initialProfile={profileRow?.profile}
              customer={customer}
              onSubmit={(form) => saveMutation.mutate(form)}
              cardClass={cardClass}
              inputClass={inputClass}
            />

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
