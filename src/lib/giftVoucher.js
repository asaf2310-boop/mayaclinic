export const GIFT_VOUCHER_UNIT_ILS = 250;
export const GIFT_VOUCHER_MIN_QTY = 1;
export const GIFT_VOUCHER_MAX_QTY = 10;

export async function redeemGiftVoucher({ code, booking }) {
  const response = await fetch("/api/public-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "redeemGiftVoucher", code, booking }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "לא ניתן לממש את השובר");
    error.status = response.status;
    throw error;
  }
  return data;
}
