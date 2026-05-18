import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageCircle, Phone, Search, UserRound } from "lucide-react";

const normalizePhone = (phone) => String(phone || "").replace(/\D/g, "");
const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const getCustomerKey = (appointment) => {
  const phone = normalizePhone(appointment.patient_phone);
  const email = normalizeEmail(appointment.patient_email);
  return `${phone || "no-phone"}|${email || "no-email"}`;
};

const formatDate = (date) => {
  if (!date) return "-";
  return format(new Date(`${date}T00:00:00`), "dd/MM/yyyy");
};

const buildWhatsAppUrl = (phone) => {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  if (normalized.startsWith("972")) return `https://wa.me/${normalized}`;
  const localNumber = normalized.startsWith("0") ? normalized.slice(1) : normalized;
  return `https://wa.me/972${localNumber}`;
};

function buildCustomers(appointments) {
  const groups = new Map();

  appointments.forEach((appointment) => {
    const key = getCustomerKey(appointment);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: appointment.patient_name || "לקוח ללא שם",
        phone: appointment.patient_phone || "",
        email: appointment.patient_email || "",
        notes: appointment.notes || "",
        marketingConsent: Boolean(appointment.marketing_consent),
        appointments: [],
      });
    }

    const customer = groups.get(key);
    customer.appointments.push(appointment);

    if (appointment.created_at > (customer.latestCreatedAt || "")) {
      customer.name = appointment.patient_name || customer.name;
      customer.phone = appointment.patient_phone || customer.phone;
      customer.email = appointment.patient_email || customer.email;
      customer.notes = appointment.notes || customer.notes;
      customer.latestCreatedAt = appointment.created_at;
    }

    customer.marketingConsent = customer.marketingConsent || Boolean(appointment.marketing_consent);
  });

  return Array.from(groups.values())
    .map((customer) => {
      const activeAppointments = customer.appointments.filter((appointment) => appointment.status !== "cancelled");
      const paidAppointments = activeAppointments.filter((appointment) => appointment.paid);
      const totalRevenue = paidAppointments.reduce((sum, appointment) => {
        return sum + (Number(appointment.treatment_price) || 0);
      }, 0);

      return {
        ...customer,
        appointments: customer.appointments.sort((a, b) => {
          const dateCompare = (b.date || "").localeCompare(a.date || "");
          if (dateCompare !== 0) return dateCompare;
          return (b.time || "").localeCompare(a.time || "");
        }),
        activeAppointmentsCount: activeAppointments.length,
        totalRevenue,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
}

export default function CustomerManagement({ appointments }) {
  const [searchTerm, setSearchTerm] = useState("");

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
      ].join(" ").toLowerCase();

      return searchable.includes(query);
    });
  }, [customers, searchTerm]);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">סה"כ לקוחות</p>
          <p className="mt-2 text-3xl font-bold">{customers.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">אישרו דיוור</p>
          <p className="mt-2 text-3xl font-bold">
            {customers.filter((customer) => customer.marketingConsent).length}
          </p>
        </Card>
        <Card className="p-5">
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
        <div className="grid gap-4">
          {filteredCustomers.map((customer) => {
            const whatsappUrl = buildWhatsAppUrl(customer.phone);
            const mailtoUrl = customer.email
              ? `mailto:${customer.email}?subject=${encodeURIComponent("עדכון ממאיה קליניק")}`
              : null;

            return (
              <Card key={customer.key} className="p-5">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                        <UserRound className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-foreground">{customer.name}</h3>
                        <div className="mt-1 flex flex-wrap gap-2 text-sm text-muted-foreground">
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
                      <Badge variant={customer.marketingConsent ? "default" : "secondary"}>
                        {customer.marketingConsent ? "אישר/ה דיוור" : "לא אישר/ה דיוור"}
                      </Badge>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
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

                    <div>
                      <p className="mb-2 text-sm font-semibold">פירוט טיפולים שהוזמנו</p>
                      <div className="space-y-2">
                        {customer.appointments.map((appointment) => (
                          <div
                            key={appointment.id}
                            className="grid gap-2 rounded-xl border border-border/60 p-3 text-sm sm:grid-cols-4"
                          >
                            <span className="font-medium">{appointment.treatment_name || "-"}</span>
                            <span className="tabular-nums">{formatDate(appointment.date)} {appointment.time || ""}</span>
                            <span>{appointment.status === "cancelled" ? "בוטל" : appointment.paid ? "שולם" : "לא שולם"}</span>
                            <span>{appointment.treatment_price ? `₪${Number(appointment.treatment_price).toLocaleString("he-IL")}` : "-"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2 lg:w-48 lg:flex-col">
                    {mailtoUrl ? (
                      <Button asChild variant="outline" className="justify-start gap-2">
                        <a href={mailtoUrl}>
                          <Mail className="h-4 w-4" />
                          שליחת אימייל
                        </a>
                      </Button>
                    ) : (
                      <Button disabled variant="outline" className="justify-start gap-2">
                        <Mail className="h-4 w-4" />
                        אין אימייל
                      </Button>
                    )}
                    {whatsappUrl ? (
                      <Button asChild variant="outline" className="justify-start gap-2">
                        <a href={whatsappUrl} target="_blank" rel="noreferrer">
                          <MessageCircle className="h-4 w-4" />
                          שליחה בוואטסאפ
                        </a>
                      </Button>
                    ) : (
                      <Button disabled variant="outline" className="justify-start gap-2">
                        <MessageCircle className="h-4 w-4" />
                        אין טלפון
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
