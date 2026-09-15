import { resolvePublicOrigin } from "./pelecard.js";

/** Never accept a return origin from browser input or forwarded headers. */
export function resolveBookingPublicBase(req, basePath = "") {
  if (!basePath) return resolvePublicOrigin(req);
  if (basePath !== "/booking") throw new Error("Unsupported booking base path");
  const configured = String(process.env.OFIRBABY_BOOKING_ORIGIN || "").trim();
  if (!configured) throw new Error("OFIRBABY_BOOKING_ORIGIN is required for integrated checkout");
  const url = new URL(configured);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
      url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("OFIRBABY_BOOKING_ORIGIN must be a trusted origin without a path");
  }
  return `${url.origin}/booking`;
}
