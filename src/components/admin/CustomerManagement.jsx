import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Mail,
  MessageCircle,
  Phone,
  Search,
  UserRound,
} from "lucide-react";
import { buildCustomers, buildWhatsAppUrl, formatDate, statusMeta } from "@/lib/customers";
import { getClinicSite } from "@/lib/clinicSite";
import { clinicGlassCard, clinicOutlineBtn } from "@/lib/clinicUi";
function PatientDetailsDialog({ customer, open, onOpenChange }) {
  if (!customer) return null;

  const whatsappUrl = buildWhatsAppUrl(customer.phone);
  const mailtoUrl = customer.email
    ? `mailto:${customer.email}?subject=${encodeURIComponent("עדכון ממאיה קליניק")}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle className="text-2xl">{customer.name}</DialogTitle>
          <DialogDescription className="text-right">
            כרטיס מטופל מלא כולל היסטוריית טיפולים, פרטי קשר ופעולות מהירות.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">סה"כ טיפולים שהושלמו</p>
            <p className="text-2xl font-bold">{customer.completedAppointmentsCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">תורים פעילים</p>
            <p className="text-2xl font-bold">{customer.activeAppointmentsCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">סה"כ תורים</p>
            <p className="text-2xl font-bold">{customer.appointments.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">הכנסות ששולמו</p>
            <p className="text-2xl font-bold">₪{customer.totalRevenue.toLocaleString("he-IL")}</p>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <Card className="p-4">
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
            <Card className="p-4">
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

            <Card className="p-4">
              <p className="mb-3 text-sm font-semibold">פעולות מהירות</p>
              <div className="space-y-2">
                {mailtoUrl ? (
                  <Button asChild variant="outline" className="w-full justify-start gap-2">
                    <a href={mailtoUrl}>
                      <Mail className="h-4 w-4" />
                      שליחת אימייל
                    </a>
                  </Button>
                ) : (
                  <Button disabled variant="outline" className="w-full justify-start gap-2">
                    <Mail className="h-4 w-4" />
                    אין אימייל
                  </Button>
                )}
                {whatsappUrl ? (
                  <Button asChild variant="outline" className="w-full justify-start gap-2">
                    <a href={whatsappUrl} target="_blank" rel="noreferrer">
                      <MessageCircle className="h-4 w-4" />
                      שליחה בוואטסאפ
                    </a>
                  </Button>
                ) : (
                  <Button disabled variant="outline" className="w-full justify-start gap-2">
                    <MessageCircle className="h-4 w-4" />
                    אין טלפון
                  </Button>
                )}
              </div>
            </Card>

            <Card className="p-4">
              <p className="mb-2 text-sm font-semibold">הערות מטופל</p>
              <p className="text-sm text-muted-foreground">
                {customer.notes || "לא הוזנו הערות עבור מטופל זה."}
              </p>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CustomerManagement({ appointments }) {
  const clinicSite = getClinicSite();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const customers = useMemo(() => buildCustomers(appointments), [appointments]);

  const filteredCustomers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return customers;

    return customers.filter((customer) => {
      const searchable = [
        customer.name,
        customer.phone,
        customer.email,
        ...customer.appointments.map((appointment) => appointment.treatment_name),
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [customers, searchTerm]);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className={`p-5 ${clinicSite ? clinicGlassCard : ""}`}>
          <p className="text-sm text-muted-foreground">סה"כ לקוחות</p>
          <p className="mt-2 text-3xl font-bold">{customers.length}</p>
        </Card>
        <Card className={`p-5 ${clinicSite ? clinicGlassCard : ""}`}>
          <p className="text-sm text-muted-foreground">אישרו דיוור</p>
          <p className="mt-2 text-3xl font-bold">
            {customers.filter((customer) => customer.marketingConsent).length}
          </p>
        </Card>
        <Card className={`p-5 ${clinicSite ? clinicGlassCard : ""}`}>
          <p className="text-sm text-muted-foreground">לקוחות עם יותר מתור אחד</p>
          <p className="mt-2 text-3xl font-bold">
            {customers.filter((customer) => customer.activeAppointmentsCount > 1).length}
          </p>
        </Card>
      </div>

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="חיפוש לפי שם, טלפון, אימייל או טיפול"
          className="pr-9"
        />
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card py-12 text-center text-muted-foreground">
          אין לקוחות להצגה
        </div>
      ) : (
        <div className="grid gap-5">
          {filteredCustomers.map((customer) => {
            const whatsappUrl = buildWhatsAppUrl(customer.phone);
            const mailtoUrl = customer.email
              ? `mailto:${customer.email}?subject=${encodeURIComponent("עדכון ממאיה קליניק")}`
              : null;

            return (
              <Card
                key={customer.key}
                className={`overflow-hidden ${clinicSite ? clinicGlassCard : "border-border/70"}`}
              >
                <div
                  className={`border-b px-5 py-4 ${
                    clinicSite ? "border-white/60 bg-white/70" : "border-border/60 bg-muted/30"
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-background shadow-sm">
                        <UserRound className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-xl font-bold text-foreground">{customer.name}</h3>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" />
                            {customer.phone || "אין טלפון"}
                          </span>
                          <span className="inline-flex items-center gap-1" dir="ltr">
                            <Mail className="h-3.5 w-3.5" />
                            {customer.email || "אין אימייל"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className={clinicSite ? clinicOutlineBtn : ""}
                        onClick={() => setSelectedCustomer(customer)}
                      >
                        כרטיס מלא
                      </Button>
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className={clinicSite ? clinicOutlineBtn : ""}
                      >
                        <Link to={`/admin/patient/${encodeURIComponent(customer.key)}`}>לעמוד מטופל</Link>
                      </Button>
                      <Badge variant={customer.marketingConsent ? "default" : "secondary"}>
                        {customer.marketingConsent ? "אישר/ה דיוור" : "לא אישר/ה דיוור"}
                      </Badge>
                      <Badge variant="outline" className="bg-background">
                        מזהה מטופל: {customer.key.slice(0, 8)}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <div className="grid gap-5 xl:grid-cols-[1fr_220px]">
                    <div className="space-y-5">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-xl bg-muted/40 p-3">
                          <p className="text-xs text-muted-foreground">סה"כ טיפולים שהושלמו</p>
                          <p className="text-lg font-bold">{customer.completedAppointmentsCount}</p>
                        </div>
                        <div className="rounded-xl bg-muted/40 p-3">
                          <p className="text-xs text-muted-foreground">תורים פעילים</p>
                          <p className="text-lg font-bold">{customer.activeAppointmentsCount}</p>
                        </div>
                        <div className="rounded-xl bg-muted/40 p-3">
                          <p className="text-xs text-muted-foreground">סה"כ תורים</p>
                          <p className="text-lg font-bold">{customer.appointments.length}</p>
                        </div>
                        <div className="rounded-xl bg-muted/40 p-3">
                          <p className="text-xs text-muted-foreground">הכנסות ששולמו</p>
                          <p className="text-lg font-bold">₪{customer.totalRevenue.toLocaleString("he-IL")}</p>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-border/60 p-3">
                          <p className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarDays className="h-3.5 w-3.5" />
                            ביקור אחרון
                          </p>
                          <p className="text-sm font-semibold">
                            {customer.lastVisit
                              ? `${formatDate(customer.lastVisit.date)} • ${customer.lastVisit.treatment_name || "טיפול"}`
                              : "אין ביקור קודם"}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/60 p-3">
                          <p className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarClock className="h-3.5 w-3.5" />
                            תור קרוב
                          </p>
                          <p className="text-sm font-semibold">
                            {customer.nextVisit
                              ? `${formatDate(customer.nextVisit.date)} ${customer.nextVisit.time || ""} • ${customer.nextVisit.treatment_name || "טיפול"}`
                              : "אין תור עתידי"}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="mb-3 text-sm font-semibold">היסטוריית טיפולים</p>
                        <div className="space-y-2">
                          {customer.appointments.map((appointment) => {
                            const meta = statusMeta(appointment.status, appointment.paid);
                            return (
                              <div
                                key={appointment.id}
                                className="grid gap-2 rounded-xl border border-border/60 p-3 text-sm sm:grid-cols-[1.3fr_1fr_1fr_0.8fr]"
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
                      </div>
                    </div>

                    <div className="space-y-3 xl:border-r xl:border-border/60 xl:pr-5">
                      <p className="text-sm font-semibold text-foreground">פעולות מהירות</p>
                      {mailtoUrl ? (
                        <Button
                          asChild
                          variant="outline"
                          className={`w-full justify-start gap-2 ${clinicSite ? clinicOutlineBtn : ""}`}
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
                          className={`w-full justify-start gap-2 ${clinicSite ? clinicOutlineBtn : ""}`}
                        >
                          <Mail className="h-4 w-4" />
                          אין אימייל
                        </Button>
                      )}
                      {whatsappUrl ? (
                        <Button
                          asChild
                          variant="outline"
                          className={`w-full justify-start gap-2 ${clinicSite ? clinicOutlineBtn : ""}`}
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
                          className={`w-full justify-start gap-2 ${clinicSite ? clinicOutlineBtn : ""}`}
                        >
                          <MessageCircle className="h-4 w-4" />
                          אין טלפון
                        </Button>
                      )}
                      <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
                        <p className="mb-1 inline-flex items-center gap-1 font-medium text-foreground">
                          <CheckCircle2 className={`h-3.5 w-3.5 ${clinicSite ? "text-[#416d5c]" : "text-emerald-600"}`} />
                          הערות מטופל
                        </p>
                        <p className="leading-5">{customer.notes || "לא הוזנו הערות עבור מטופל זה."}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <PatientDetailsDialog
        customer={selectedCustomer}
        open={Boolean(selectedCustomer)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSelectedCustomer(null);
        }}
      />
    </div>
  );
}
