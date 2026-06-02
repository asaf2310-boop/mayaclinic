import React, { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Navbar from "@/components/layout/Navbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Mail, MessageCircle, Phone } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { buildCustomers, buildWhatsAppUrl, formatDate, statusMeta } from "@/lib/customers";
import { getClinicSite } from "@/lib/clinicSite";

export default function AdminPatient() {
  const clinicSite = getClinicSite();
  const { patientKey = "" } = useParams();
  const decodedKey = decodeURIComponent(patientKey);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments"],
    queryFn: () => base44.entities.Appointment.list("date"),
  });

  const customer = useMemo(() => {
    const customers = buildCustomers(appointments);
    return customers.find((item) => item.key === decodedKey) || null;
  }, [appointments, decodedKey]);

  if (isLoading) {
    return (
      <div
        className={`min-h-screen ${
          clinicSite ? "bg-gradient-to-tr from-[#f3f7f4] via-[#edf3ee] to-[#e6ece7]" : "bg-background"
        }`}
      >
        <Navbar />
        <main className="px-6 pb-16 pt-24" dir="rtl">
          <div className="mx-auto max-w-6xl space-y-4">
            <Skeleton className="h-12 w-60 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        </main>
      </div>
    );
  }

  if (!customer) {
    return (
      <div
        className={`min-h-screen ${
          clinicSite ? "bg-gradient-to-tr from-[#f3f7f4] via-[#edf3ee] to-[#e6ece7]" : "bg-background"
        }`}
      >
        <Navbar />
        <main className="px-6 pb-16 pt-24" dir="rtl">
          <div className="mx-auto max-w-3xl">
            <Card className="p-8 text-center">
              <h1 className="text-2xl font-bold">מטופל לא נמצא</h1>
              <p className="mt-2 text-muted-foreground">ייתכן שהמזהה אינו תקין או שאין תורים עבור המטופל.</p>
              <Button
                asChild
                className={`mt-6 ${
                  clinicSite
                    ? "rounded-2xl bg-gradient-to-r from-[#416d5c] to-[#2f5245] text-white shadow-[0_10px_25px_rgba(65,109,92,0.2)]"
                    : ""
                }`}
              >
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
    ? `mailto:${customer.email}?subject=${encodeURIComponent("עדכון ממאיה קליניק")}`
    : null;

  return (
    <div
      className={`min-h-screen ${
        clinicSite ? "bg-gradient-to-tr from-[#f3f7f4] via-[#edf3ee] to-[#e6ece7]" : "bg-background"
      }`}
    >
      <Navbar />
      <main className="relative px-6 pb-16 pt-24" dir="rtl">
        {clinicSite && (
          <>
            <div className="pointer-events-none absolute left-0 top-24 h-[280px] w-[280px] rounded-full bg-[#e1eae2] blur-[130px]" />
            <div className="pointer-events-none absolute right-0 top-40 h-[320px] w-[320px] rounded-full bg-[#d7e4dc] blur-[140px]" />
          </>
        )}
        <div className="relative mx-auto max-w-6xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className={`text-3xl font-bold ${clinicSite ? "text-[#1a2e28]" : ""}`}>{customer.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">כרטיס מטופל מלא</p>
            </div>
            <Button
              asChild
              variant="outline"
              className={
                clinicSite ? "rounded-2xl border-[#bcd0c4] bg-white/40 backdrop-blur-md hover:bg-white/60" : ""
              }
            >
              <Link to="/admin" className="inline-flex items-center gap-2">
                <ArrowRight className="h-4 w-4" />
                חזרה לניהול
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Card className={`p-4 ${clinicSite ? "border-white/70 bg-white/75 shadow-[0_4px_12px_rgba(0,0,0,0.02)] backdrop-blur-xl" : ""}`}>
              <p className="text-xs text-muted-foreground">סה"כ טיפולים שהושלמו</p>
              <p className="text-2xl font-bold">{customer.completedAppointmentsCount}</p>
            </Card>
            <Card className={`p-4 ${clinicSite ? "border-white/70 bg-white/75 shadow-[0_4px_12px_rgba(0,0,0,0.02)] backdrop-blur-xl" : ""}`}>
              <p className="text-xs text-muted-foreground">תורים פעילים</p>
              <p className="text-2xl font-bold">{customer.activeAppointmentsCount}</p>
            </Card>
            <Card className={`p-4 ${clinicSite ? "border-white/70 bg-white/75 shadow-[0_4px_12px_rgba(0,0,0,0.02)] backdrop-blur-xl" : ""}`}>
              <p className="text-xs text-muted-foreground">סה"כ תורים</p>
              <p className="text-2xl font-bold">{customer.appointments.length}</p>
            </Card>
            <Card className={`p-4 ${clinicSite ? "border-white/70 bg-white/75 shadow-[0_4px_12px_rgba(0,0,0,0.02)] backdrop-blur-xl" : ""}`}>
              <p className="text-xs text-muted-foreground">הכנסות ששולמו</p>
              <p className="text-2xl font-bold">₪{customer.totalRevenue.toLocaleString("he-IL")}</p>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
            <Card className={`p-4 ${clinicSite ? "border-white/70 bg-white/75 shadow-[0_4px_12px_rgba(0,0,0,0.02)] backdrop-blur-xl" : ""}`}>
              <p className="mb-3 text-sm font-semibold">היסטוריית טיפולים</p>
              <div className="space-y-2">
                {customer.appointments.map((appointment) => {
                  const meta = statusMeta(appointment.status, appointment.paid);
                  return (
                    <div
                      key={appointment.id}
                      className="grid gap-2 rounded-xl border border-border/60 p-3 text-sm sm:grid-cols-[1.5fr_1fr_1fr_0.8fr]"
                    >
                      <span className="font-medium">{appointment.treatment_name || "-"}</span>
                      <span className="tabular-nums">
                        {formatDate(appointment.date)} {appointment.time || ""}
                      </span>
                      <span>
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${meta.className}`}>
                          {meta.label}
                        </span>
                      </span>
                      <span className="font-medium">
                        {appointment.treatment_price
                          ? `₪${Number(appointment.treatment_price).toLocaleString("he-IL")}`
                          : "-"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>

            <div className="space-y-4">
              <Card className={`p-4 ${clinicSite ? "border-white/70 bg-white/75 shadow-[0_4px_12px_rgba(0,0,0,0.02)] backdrop-blur-xl" : ""}`}>
                <p className="mb-3 text-sm font-semibold">פרטי קשר</p>
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

              <Card className={`p-4 ${clinicSite ? "border-white/70 bg-white/75 shadow-[0_4px_12px_rgba(0,0,0,0.02)] backdrop-blur-xl" : ""}`}>
                <p className="mb-3 text-sm font-semibold">פעולות</p>
                <div className="space-y-2">
                  {mailtoUrl ? (
                    <Button
                      asChild
                      variant="outline"
                      className={`w-full justify-start gap-2 ${
                        clinicSite ? "rounded-2xl border-[#bcd0c4] bg-white/40 backdrop-blur-md hover:bg-white/60" : ""
                      }`}
                    >
                      <a href={mailtoUrl}>
                        <Mail className="h-4 w-4" />
                        שליחת אימייל
                      </a>
                    </Button>
                  ) : (
                    <Button
                      disabled
                      variant="outline"
                      className={`w-full justify-start gap-2 ${
                        clinicSite ? "rounded-2xl border-[#bcd0c4] bg-white/40 backdrop-blur-md" : ""
                      }`}
                    >
                      <Mail className="h-4 w-4" />
                      אין אימייל
                    </Button>
                  )}
                  {whatsappUrl ? (
                    <Button
                      asChild
                      variant="outline"
                      className={`w-full justify-start gap-2 ${
                        clinicSite ? "rounded-2xl border-[#bcd0c4] bg-white/40 backdrop-blur-md hover:bg-white/60" : ""
                      }`}
                    >
                      <a href={whatsappUrl} target="_blank" rel="noreferrer">
                        <MessageCircle className="h-4 w-4" />
                        שליחה בוואטסאפ
                      </a>
                    </Button>
                  ) : (
                    <Button
                      disabled
                      variant="outline"
                      className={`w-full justify-start gap-2 ${
                        clinicSite ? "rounded-2xl border-[#bcd0c4] bg-white/40 backdrop-blur-md" : ""
                      }`}
                    >
                      <MessageCircle className="h-4 w-4" />
                      אין טלפון
                    </Button>
                  )}
                </div>
              </Card>

              <Card className={`p-4 ${clinicSite ? "border-white/70 bg-white/75 shadow-[0_4px_12px_rgba(0,0,0,0.02)] backdrop-blur-xl" : ""}`}>
                <p className="mb-2 text-sm font-semibold">הערות מטופל</p>
                <p className="text-sm text-muted-foreground">
                  {customer.notes || "לא הוזנו הערות עבור מטופל זה."}
                </p>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
