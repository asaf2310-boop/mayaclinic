/**
 * Unit checks for treatment write helpers (no Supabase required).
 * Usage: node scripts/test-treatment-write.mjs
 */

import {
  missingColumnFromPostgrestError,
  omitRowKeys,
  stripTenantIdFromUpdate,
} from "../src/lib/supabaseWriteHelpers.js";

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
}

assert(
  missingColumnFromPostgrestError(
    '{"code":"PGRST204","message":"Could not find the \'paybox_link\' column of \'treatments\' in the schema cache"}'
  ) === "paybox_link",
  "detect paybox_link missing column"
);

assert(
  missingColumnFromPostgrestError(
    '{"code":"PGRST204","message":"Could not find the \'tenant_id\' column of \'treatments\' in the schema cache"}'
  ) === "tenant_id",
  "detect tenant_id missing column"
);

assert(
  omitRowKeys({ name: "a", tenant_id: "maya", paybox_link: "x" }, ["tenant_id"]).tenant_id ===
    undefined,
  "omit tenant_id from payload"
);

assert(
  omitRowKeys({ name: "a", paybox_link: "x" }, ["paybox_link"]).paybox_link === undefined,
  "omit paybox_link from payload"
);

assert(
  stripTenantIdFromUpdate({ name: "a", tenant_id: "maya" }).tenant_id === undefined,
  "strip tenant_id from PATCH payload"
);

console.log("OK: treatment write helper tests passed");
