import assert from "node:assert/strict";
import {
  createAdminSessionToken,
  getAdminSession,
} from "../server/adminSession.js";

process.env.ADMIN_SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET || "test-admin-session-secret-for-mobile";

const token = createAdminSessionToken({ email: "owner@example.com", method: "password" });
assert.ok(token.includes("."), "token should be signed");

const session = getAdminSession({
  headers: { authorization: `Bearer ${token}` },
});
assert.equal(session?.email, "owner@example.com");
assert.equal(session?.method, "password");

const bad = getAdminSession({
  headers: { authorization: "Bearer not-a-valid-token" },
});
assert.equal(bad, null);

console.log("admin-mobile-token.test.mjs: ok");
