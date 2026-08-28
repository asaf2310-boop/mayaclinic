import { randomBytes } from "node:crypto";
import { supabaseRequest } from "./supabaseServer.js";

export const GIFT_VOUCHER_UNIT_ILS = 250;
export const GIFT_VOUCHER_MIN_QTY = 1;
export const GIFT_VOUCHER_MAX_QTY = 10;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeVoucherCode(value = "") {
  const compact = String(value).toUpperCase().replace(/[\s-]/g, "");
  return compact.startsWith("OFIR") ? `OFIR-${compact.slice(4, 10)}` : `OFIR-${compact.slice(0, 6)}`;
}

export function createVoucherCode() {
  const bytes = randomBytes(6);
  return `OFIR-${Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("")}`;
}

export async function createPendingGiftVoucher({ bookingRef, quantity, purchaserName, purchaserPhone, purchaserEmail, recipientName, recipientEmail, recipientPhone, sendToRecipient, sendToWhatsapp, greeting, tenantId }) {
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > 10) throw Object.assign(new Error("כמות הטיפולים אינה תקינה"), { status: 400 });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const rows = await supabaseRequest("gift_vouchers", {
        method: "POST", headers: { Prefer: "return=representation" },
        body: JSON.stringify({ code: createVoucherCode(), status: "pending_payment", treatments_total: qty, treatments_remaining: 0, unit_price_agorot: 25000, amount_agorot: qty * 25000, purchaser_name: purchaserName, purchaser_phone: purchaserPhone, purchaser_email: purchaserEmail, recipient_name: recipientName, recipient_email: sendToRecipient ? recipientEmail : null, recipient_phone: sendToWhatsapp ? recipientPhone : null, send_to_recipient: Boolean(sendToRecipient), send_to_whatsapp: Boolean(sendToWhatsapp), greeting: greeting || null, pelecard_booking_ref: bookingRef, tenant_id: tenantId || "maya" }),
      });
      return Array.isArray(rows) ? rows[0] : rows;
    } catch (error) { if (attempt === 4 || !String(error?.message).toLowerCase().includes("duplicate")) throw error; }
  }
}

export async function activateGiftVoucher(bookingRef) {
  const ref = encodeURIComponent(bookingRef);
  const found = await supabaseRequest(`gift_vouchers?pelecard_booking_ref=eq.${ref}&select=*&limit=1`);
  const voucher = found?.[0];
  if (!voucher) throw new Error("Gift voucher not found");
  if (voucher.status === "active" || voucher.status === "exhausted") return { voucher, alreadyActive: true };
  const rows = await supabaseRequest(`gift_vouchers?id=eq.${encodeURIComponent(voucher.id)}&status=eq.pending_payment`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "active", treatments_remaining: voucher.treatments_total, updated_at: new Date().toISOString() }) });
  if (rows?.[0]) return { voucher: rows[0], alreadyActive: false };
  const latest = await supabaseRequest(`gift_vouchers?id=eq.${encodeURIComponent(voucher.id)}&select=*&limit=1`);
  return { voucher: latest?.[0] || voucher, alreadyActive: true };
}

export async function getPaidGiftVoucher(bookingRef) {
  const rows = await supabaseRequest(`gift_vouchers?pelecard_booking_ref=eq.${encodeURIComponent(bookingRef)}&status=in.(active,exhausted)&select=*&limit=1`);
  return rows?.[0] || null;
}

export async function redeemVoucherAtomic({ code, count, tenantId }) {
  try {
    return await supabaseRequest("rpc/redeem_gift_voucher", { method: "POST", body: JSON.stringify({ p_code: normalizeVoucherCode(code), p_count: count, p_tenant: tenantId }) });
  } catch (error) {
    const message = String(error?.message || "");
    if (message.includes("VOUCHER_BALANCE")) throw Object.assign(new Error(`השובר אינו מכסה ${count} טיפולים שנבחרו`), { status: 400 });
    if (message.includes("VOUCHER_NOT_ACTIVE")) throw Object.assign(new Error("השובר לא נמצא או אינו פעיל"), { status: 404 });
    throw error;
  }
}

export async function appendVoucherAppointments(id, appointmentIds) {
  const rows = await supabaseRequest(`gift_vouchers?id=eq.${encodeURIComponent(id)}&select=appointment_ids&limit=1`);
  const ids = [...new Set([...(rows?.[0]?.appointment_ids || []), ...appointmentIds])];
  await supabaseRequest(`gift_vouchers?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ appointment_ids: ids, updated_at: new Date().toISOString() }) });
}

export async function restoreVoucherBalance(id, count) {
  await supabaseRequest("rpc/restore_gift_voucher", { method: "POST", body: JSON.stringify({ p_id: id, p_count: count }) });
}
