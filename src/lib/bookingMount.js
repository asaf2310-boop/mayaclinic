/** The same build serves the original app and the OFIRBABY booking mount. */
export function getBookingBasePath(pathname = typeof window === "undefined" ? "" : window.location.pathname) {
  return pathname === "/booking" || pathname.startsWith("/booking/") ? "/booking" : "";
}

export function isBookingAdminPath(pathname = typeof window === "undefined" ? "" : window.location.pathname) {
  const base = getBookingBasePath(pathname);
  if (base) return pathname === `${base}/admin` || pathname.startsWith(`${base}/admin/`);
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/** Public booking pages only — not /booking/admin. */
export function isPublicBookingMount(pathname = typeof window === "undefined" ? "" : window.location.pathname) {
  return Boolean(getBookingBasePath(pathname)) && !isBookingAdminPath(pathname);
}

export const bookingBasePath = getBookingBasePath();

export function bookingUrl(path, basePath = bookingBasePath) {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) return path;
  if (!basePath || path === basePath || path.startsWith(`${basePath}/`)) return path;
  return `${basePath}${path}`;
}

function withAdminMountQuery(url, basePath = bookingBasePath) {
  if (!basePath || typeof url !== "string" || !url.includes("/api/admin")) return url;
  const [path, query = ""] = url.split("?");
  const params = new URLSearchParams(query);
  if (!params.has("bookingBasePath")) params.set("bookingBasePath", basePath);
  return `${path}?${params}`;
}

export function bookingFetch(input, options = {}) {
  const url = withAdminMountQuery(bookingUrl(typeof input === "string" ? input : String(input)));
  const sameOrigin = typeof url === "string" && url.startsWith("/");
  return fetch(url, {
    ...(sameOrigin ? { credentials: "include" } : {}),
    ...options,
  });
}
