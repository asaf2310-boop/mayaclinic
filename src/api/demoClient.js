const DEMO_STORE_KEY = "mayaclinic-demo-store-v1";

export const demoModeEnabled = import.meta.env.VITE_DEMO_MODE === "true";

const ENTITY_KEYS = {
  Treatment: "treatments",
  Availability: "availability",
  Appointment: "appointments",
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

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createSeedStore() {
  const today = new Date();
  const dates = [1, 2, 3, 5, 7, 9, 12].map((days) => formatDate(addDays(today, days)));

  const treatments = [
    { id: "treatment_laser", name: "טיפול לייזר", description: "טיפול אסתטי ממוקד", price: 350, duration: 45, is_active: true },
    { id: "treatment_facial", name: "טיפול פנים", description: "ניקוי, הזנה ולחות לעור", price: 280, duration: 60, is_active: true },
    { id: "treatment_consult", name: "פגישת ייעוץ", description: "אבחון והתאמת תכנית טיפול", price: 150, duration: 30, is_active: true },
  ];

  const availability = dates.map((date, index) => ({
    id: `availability_${index}`,
    date,
    slots: ["09:00", "10:30", "12:00", "14:00", "16:00", "17:30"],
    is_active: true,
  }));

  const appointments = [
    {
      id: "appointment_demo_1",
      patient_name: "נועה כהן",
      patient_phone: "050-1234567",
      patient_email: "noa@example.com",
      treatment_id: "treatment_facial",
      treatment_name: "טיפול פנים",
      treatment_price: 280,
      date: dates[0],
      time: "10:30",
      status: "confirmed",
      paid: true,
      marketing_consent: true,
      notes: "עור רגיש",
      created_at: new Date().toISOString(),
    },
    {
      id: "appointment_demo_2",
      patient_name: "דנה לוי",
      patient_phone: "052-7654321",
      patient_email: "dana@example.com",
      treatment_id: "treatment_laser",
      treatment_name: "טיפול לייזר",
      treatment_price: 350,
      date: dates[2],
      time: "14:00",
      status: "pending",
      paid: false,
      marketing_consent: false,
      notes: "",
      created_at: new Date().toISOString(),
    },
    {
      id: "appointment_demo_3",
      patient_name: "נועה כהן",
      patient_phone: "050-1234567",
      patient_email: "noa@example.com",
      treatment_id: "treatment_consult",
      treatment_name: "פגישת ייעוץ",
      treatment_price: 150,
      date: dates[4],
      time: "12:00",
      status: "completed",
      paid: true,
      marketing_consent: true,
      notes: "המשך טיפול",
      created_at: new Date().toISOString(),
    },
  ];

  return { treatments, availability, appointments };
}

function readStore() {
  const raw = localStorage.getItem(DEMO_STORE_KEY);
  if (raw) return JSON.parse(raw);

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
