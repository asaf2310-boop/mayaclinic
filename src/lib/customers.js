import { format } from "date-fns";

export const normalizePhone = (phone) => String(phone || "").replace(/\D/g, "");
export const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

export const getCustomerKey = (appointment) => {
  const phone = normalizePhone(appointment.patient_phone);
  const email = normalizeEmail(appointment.patient_email);
  return `${phone || "no-phone"}|${email || "no-email"}`;
};

export const formatDate = (date) => {
  if (!date) return "-";
  return format(new Date(`${date}T00:00:00`), "dd/MM/yyyy");
};

export const statusMeta = (status, paid) => {
  if (status === "cancelled") return { label: "בוטל", className: "bg-red-100 text-red-700" };
  if (status === "completed") return { label: paid ? "הושלם ושולם" : "הושלם", className: "bg-emerald-100 text-emerald-700" };
  if (status === "confirmed") return { label: paid ? "מאושר ושולם" : "מאושר", className: "bg-blue-100 text-blue-700" };
  return { label: "ממתין", className: "bg-amber-100 text-amber-700" };
};

export const buildWhatsAppUrl = (phone) => {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  if (normalized.startsWith("972")) return `https://wa.me/${normalized}`;
  const localNumber = normalized.startsWith("0") ? normalized.slice(1) : normalized;
  return `https://wa.me/972${localNumber}`;
};

export function buildCustomers(appointments) {
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
      const completedAppointments = customer.appointments.filter((appointment) => appointment.status === "completed");
      const totalRevenue = paidAppointments.reduce((sum, appointment) => sum + (Number(appointment.treatment_price) || 0), 0);

      const sortedByDateAsc = [...customer.appointments].sort((a, b) => {
        const dateCompare = (a.date || "").localeCompare(b.date || "");
        if (dateCompare !== 0) return dateCompare;
        return (a.time || "").localeCompare(b.time || "");
      });

      const todayIso = new Date().toISOString().slice(0, 10);
      const lastVisit = [...sortedByDateAsc]
        .reverse()
        .find((appointment) => appointment.status !== "cancelled" && appointment.date && appointment.date <= todayIso);
      const nextVisit = sortedByDateAsc.find(
        (appointment) => appointment.status !== "cancelled" && appointment.date && appointment.date >= todayIso
      );

      return {
        ...customer,
        appointments: customer.appointments.sort((a, b) => {
          const dateCompare = (b.date || "").localeCompare(a.date || "");
          if (dateCompare !== 0) return dateCompare;
          return (b.time || "").localeCompare(a.time || "");
        }),
        activeAppointmentsCount: activeAppointments.length,
        completedAppointmentsCount: completedAppointments.length,
        totalRevenue,
        lastVisit,
        nextVisit,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
}
