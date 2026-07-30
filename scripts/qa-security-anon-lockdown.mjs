/**
 * Verifies anon cannot read/write clinic tables after security-lockdown-anon.sql.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/qa-security-anon-lockdown.mjs
 */
const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const anon = String(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim();

if (!url || !anon) {
  console.error("Need SUPABASE_URL and SUPABASE_ANON_KEY");
  process.exit(1);
}

async function req(path, options = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  return { status: response.status, text };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  for (const table of ["availability", "treatments", "appointments", "pelecard_payments"]) {
    const read = await req(`${table}?select=*&limit=1`);
    assert(
      read.status === 401 ||
        read.status === 403 ||
        read.text === "[]" ||
        /permission denied|row-level security|not find/i.test(read.text),
      `${table} still readable by anon: ${read.status} ${read.text.slice(0, 120)}`
    );
  }

  const write = await req("availability?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      date: "2099-01-02",
      slots: ["09:00"],
      is_active: true,
      tenant_id: "maya",
    }),
  });
  assert(
    write.status === 401 ||
      write.status === 403 ||
      /row-level security|permission denied|42501/i.test(write.text),
    `anon can still insert availability: ${write.status} ${write.text.slice(0, 160)}`
  );

  console.log("QA PASSED: anon lockdown looks effective");
}

main().catch((error) => {
  console.error("QA FAILED:", error.message);
  process.exit(1);
});
