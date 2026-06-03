import { supabaseConfigured } from "./supabase";
import { isProductionClinicHost } from "@/lib/clinicSite";
import { hasAppointmentTimeConflict } from "@/lib/bookingSlots";

const DEMO_STORE_KEY = "mayaclinic-demo-store-v5";

const demoEnvEnabled = import.meta.env.VITE_DEMO_MODE === "true";
const forceDemoEnabled = import.meta.env.VITE_FORCE_DEMO === "true";
const hostname = typeof window !== "undefined" ? String(window.location.hostname).toLowerCase() : "";
const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";
const demoHostEnabled = /-demo\.vercel\.app$/i.test(hostname);

// Never run demo mode on production clinic domains (e.g. maya-clinic.vercel.app).
export const demoModeEnabled =
  !isProductionClinicHost(hostname) &&
  (forceDemoEnabled ||
    demoHostEnabled ||
    (demoEnvEnabled && (isLocalHost || !supabaseConfigured)));

const ENTITY_KEYS = {
  Treatment: "treatments",
  Availability: "availability",
  Appointment: "appointments",
  PatientProfile: "patient_profiles",
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function monthDate(baseDate, monthOffset, day) {
  return formatDate(new Date(baseDate.getFullYear(), baseDate.getMonth() + monthOffset, day));
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createSeedStore() {
  const today = new Date();
  const futureDates = [1, 2, 3, 5, 7, 9, 12, 15, 18, 21].map((days) => formatDate(addDays(today, days)));

  const treatments = [
    { id: "treatment_maya", name: "מגע שיקומי", description: "טיפול מגע שיקומי לפי שיטת מאיה", price: 320, duration: 60, duration_minutes: 60, is_active: true },
    { id: "treatment_laser", name: "טיפול לייזר", description: "טיפול אסתטי ממוקד", price: 350, duration: 45, duration_minutes: 45, is_active: true },
    { id: "treatment_facial", name: "טיפול פנים קלאסי", description: "ניקוי, הזנה ולחות לעור", price: 280, duration: 60, duration_minutes: 60, is_active: true },
    { id: "treatment_consult", name: "פגישת ייעוץ", description: "אבחון והתאמת תכנית טיפול", price: 150, duration: 30, duration_minutes: 30, is_active: true },
    { id: "treatment_peeling", name: "פילינג רפואי", description: "חידוש מרקם העור והבהרה", price: 420, duration: 50, duration_minutes: 50, is_active: true },
    { id: "treatment_brows", name: "עיצוב גבות", description: "עיצוב והתאמה למבנה הפנים", price: 120, duration: 30, duration_minutes: 30, is_active: true },
  ];

  const availability = futureDates.map((date, index) => ({
    id: `availability_${index}`,
    date,
    slots: ["09:00", "10:30", "12:00", "14:00", "16:00", "17:30"],
    is_active: true,
  }));

  const appointmentRows = [
    ["נועה כהן", "050-1234567", "noa@example.com", "treatment_facial", -2, 8, "10:30", "completed", true, true, "עור רגיש"],
    ["נועה כהן", "050-1234567", "noa@example.com", "treatment_peeling", -1, 14, "12:00", "completed", true, true, "מעקב לאחר טיפול"],
    ["נועה כהן", "050-1234567", "noa@example.com", "treatment_consult", 0, 22, "16:00", "confirmed", false, true, "המשך תכנית טיפול"],
    ["דנה לוי", "052-7654321", "dana@example.com", "treatment_laser", -2, 18, "14:00", "completed", true, false, ""],
    ["דנה לוי", "052-7654321", "dana@example.com", "treatment_laser", -1, 21, "14:00", "completed", true, false, "סדרה חודשית"],
    ["דנה לוי", "052-7654321", "dana@example.com", "treatment_laser", 0, 28, "14:00", "pending", false, false, ""],
    ["מיכל אברהם", "054-2223344", "michal@example.com", "treatment_facial", -1, 4, "09:00", "completed", true, true, "לקוחה חדשה"],
    ["מיכל אברהם", "054-2223344", "michal@example.com", "treatment_brows", 0, 12, "10:30", "confirmed", true, true, ""],
    ["יעל מזרחי", "053-9988776", "yael@example.com", "treatment_peeling", -3, 11, "12:00", "completed", true, true, "רוצה לקבל מבצעים"],
    ["יעל מזרחי", "053-9988776", "yael@example.com", "treatment_facial", -2, 24, "09:00", "completed", true, true, ""],
    ["שירה ביטון", "058-1112233", "shira@example.com", "treatment_consult", -1, 9, "17:30", "cancelled", false, false, "ביטלה טלפונית"],
    ["שירה ביטון", "058-1112233", "shira@example.com", "treatment_facial", 0, 18, "17:30", "pending", false, false, ""],
    ["רוני פרץ", "050-5550199", "roni@example.com", "treatment_laser", -3, 7, "16:00", "completed", true, true, "שילמה במקום"],
    ["רוני פרץ", "050-5550199", "roni@example.com", "treatment_peeling", -2, 6, "10:30", "completed", true, true, ""],
    ["אורטל שלום", "052-4448899", "ortal@example.com", "treatment_brows", -1, 26, "12:00", "completed", true, true, ""],
    ["אורטל שלום", "052-4448899", "ortal@example.com", "treatment_brows", 0, 25, "12:00", "confirmed", false, true, "תזכורת יום לפני"],
    ["ליאת בר", "054-7776655", "liat@example.com", "treatment_facial", -3, 19, "09:00", "completed", true, false, ""],
    ["ליאת בר", "054-7776655", "liat@example.com", "treatment_consult", -1, 17, "16:00", "completed", true, false, "ייעוץ המשך"],
  ];

  const treatmentById = Object.fromEntries(treatments.map((treatment) => [treatment.id, treatment]));
  const appointments = appointmentRows.map((row, index) => {
    const [name, phone, email, treatmentId, monthOffset, day, time, status, paid, marketingConsent, notes] = row;
    const treatment = treatmentById[treatmentId];

    return {
      id: `appointment_demo_${index + 1}`,
      patient_name: name,
      patient_phone: phone,
      patient_email: email,
      treatment_id: treatmentId,
      treatment_name: treatment.name,
      treatment_price: treatment.price,
      date: monthDate(today, monthOffset, day),
      time,
      status,
      paid,
      marketing_consent: marketingConsent,
      notes,
      created_at: new Date(today.getFullYear(), today.getMonth() + monthOffset, Math.max(day - 3, 1), 9).toISOString(),
    };
  });

  const patient_profiles = [
    {
      id: "profile_noa",
      customer_key: "0501234567|noa@example.com",
      patient_name: "נועה כהן",
      patient_phone: "050-1234567",
      patient_email: "noa@example.com",
      profile: {
        gender: "female",
        maritalStatus: "single",
        occupation: "מעצבת גרפית",
        patientType: "individual",
        city: "תל אביב",
        address: "רothschild 12",
        zip: "6688101",
        hmo: "maccabi",
        preferredContact: "whatsapp",
        intakeNotes: "פניות לעור רגיש. הגיעה בהמלצת חברה.",
        treatmentGoals: "הרגעה, שיקום רגשי, שיפור שינה",
        continuousNotes: "מגיבה היטב למגע שיקומי. לשים לב ללחץ בכתפיים.",
        sessionLocation: "clinic",
        preferredTimes: "בוקר, ימי שלישי",
        medicalBackground: "ללא רגישויות ידועות. טיפול פסיכולוגי בעבר.",
        fundingSource: "private",
        sessionPrice: "320",
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "profile_dana",
      customer_key: "0527654321|dana@example.com",
      patient_name: "דנה לוי",
      patient_phone: "052-7654321",
      patient_email: "dana@example.com",
      profile: {
        gender: "female",
        maritalStatus: "married",
        occupation: "רואת חשבון",
        patientType: "individual",
        city: "רמת גן",
        hmo: "clalit",
        preferredContact: "phone",
        treatmentGoals: "הפחתת מתח, שחרור שרירים",
        continuousNotes: "סדרת טיפולי לייזר + מגע שיקומי.",
        sessionLocation: "clinic",
        fundingSource: "private",
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  return { treatments, availability, appointments, patient_profiles };
}

function readStore() {
  const raw = localStorage.getItem(DEMO_STORE_KEY);
  if (raw) {
    try {
      const store = JSON.parse(raw);
      if (store?.treatments?.length && store?.availability?.length && store?.appointments?.length) {
        if (!store.patient_profiles) {
          store.patient_profiles = createSeedStore().patient_profiles;
          writeStore(store);
        }
        return store;
      }
    } catch {
      localStorage.removeItem(DEMO_STORE_KEY);
    }
  }

  const seed = createSeedStore();
  localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(seed));
  return seed;
}

function writeStore(store) {
  localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(store));
}

function matchesFilters(row, filters) {
  return Object.entries(filters).every(([key, value]) => row[key] === value);
}

function sortRows(rows, order) {
  const orderColumn = String(order || "-created_at");
  const desc = orderColumn.startsWith("-");
  const column = desc ? orderColumn.slice(1) : orderColumn;

  rows.sort((a, b) => String(a[column] || "").localeCompare(String(b[column] || "")));
  if (desc) rows.reverse();
  return rows;
}

function createEntity(entityName) {
  const storeKey = ENTITY_KEYS[entityName];

  return {
    async filter(filters = {}) {
      const rows = readStore()[storeKey] || [];
      return rows.filter((row) => matchesFilters(row, filters));
    },

    async list(order = "-created_at", limit = 100) {
      const rows = sortRows([...(readStore()[storeKey] || [])], order);
      return rows.slice(0, limit);
    },

    async create(row) {
      const store = readStore();
      if (entityName === "Appointment") {
        const existing = store[storeKey] || [];
        if (hasAppointmentTimeConflict(row, existing)) {
          throw new Error("appointment_time_conflict");
        }
      }
      const saved = {
        id: row.id || makeId(storeKey),
        created_at: row.created_at || new Date().toISOString(),
        ...row,
      };
      store[storeKey] = [...(store[storeKey] || []), saved];
      writeStore(store);
      return saved;
    },

    async bulkCreate(rows) {
      const store = readStore();
      if (entityName === "Appointment") {
        const existing = [...(store[storeKey] || [])];
        for (const row of rows) {
          if (hasAppointmentTimeConflict(row, existing)) {
            throw new Error("appointment_time_conflict");
          }
          existing.push(row);
        }
      }
      const saved = rows.map((row) => ({
        id: row.id || makeId(storeKey),
        created_at: row.created_at || new Date().toISOString(),
        ...row,
      }));
      store[storeKey] = [...(store[storeKey] || []), ...saved];
      writeStore(store);
      return saved;
    },

    async update(id, row) {
      const store = readStore();
      let updated = null;
      store[storeKey] = (store[storeKey] || []).map((existing) => {
        if (existing.id !== id) return existing;
        updated = { ...existing, ...row };
        return updated;
      });
      if (entityName === "Appointment" && updated) {
        const others = (store[storeKey] || []).filter((existing) => existing.id !== id);
        if (hasAppointmentTimeConflict(updated, others)) {
          throw new Error("appointment_time_conflict");
        }
      }
      writeStore(store);
      return updated;
    },

    async delete(id) {
      const store = readStore();
      store[storeKey] = (store[storeKey] || []).filter((row) => row.id !== id);
      writeStore(store);
    },
  };
}

export function createDemoDataClient() {
  const entities = {};
  for (const entityName of Object.keys(ENTITY_KEYS)) {
    entities[entityName] = createEntity(entityName);
  }

  return {
    entities,
    auth: {
      me: async () => ({ id: "demo-admin", role: "admin", full_name: "מנהל דמו" }),
      logout: () => {},
      redirectToLogin: () => {},
    },
  };
}
