import { resolvePublicOrigin } from "./pelecard.js";

export function getRequestBookingBasePath(req) {
  const query = String(req?.query?.bookingBasePath || "").trim();
  if (query === "/booking") return "/booking";

  const forwardedUri = String(req?.headers?.["x-forwarded-uri"] || req?.url || "");
  if (
    forwardedUri === "/booking" ||
    forwardedUri.startsWith("/booking/") ||
    forwardedUri.includes("/booking/api/")
  ) {
    return "/booking";
  }

  const referer = String(req?.headers?.referer || req?.headers?.referrer || "");
  try {
    if (referer) {
      const url = new URL(referer);
      if (url.pathname === "/booking" || url.pathname.startsWith("/booking/")) return "/booking";
    }
  } catch {
    /* ignore malformed referer */
  }

  return "";
}

export function resolveAdminAppOrigin(req, basePath = getRequestBookingBasePath(req)) {
  if (basePath === "/booking") {
    try {
      return resolveBookingPublicBase(req, "/booking").replace(/\/booking$/, "");
    } catch {
      const proto = String(req?.headers?.["x-forwarded-proto"] || "https").split(",")[0].trim();
      const host = String(req?.headers?.["x-forwarded-host"] || req?.headers?.host || "")
        .split(",")[0]
        .trim();
      if (host) return `${proto}://${host}`.replace(/\/$/, "");
    }
  }
  return resolvePublicOrigin(req);
}

export function resolveAdminFrontPath(basePath, path = "/admin") {
  if (basePath === "/booking") return `/booking${path === "/" ? "" : path}`;
  return path;
}

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
