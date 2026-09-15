/** The same build serves the original app and the OFIRBABY booking mount. */
export function getBookingBasePath(pathname = typeof window === "undefined" ? "" : window.location.pathname) {
  return pathname === "/booking" || pathname.startsWith("/booking/") ? "/booking" : "";
}

export const bookingBasePath = getBookingBasePath();

export function bookingUrl(path, basePath = bookingBasePath) {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) return path;
  if (!basePath || path === basePath || path.startsWith(`${basePath}/`)) return path;
  return `${basePath}${path}`;
}

export function bookingFetch(input, options) {
  return fetch(bookingUrl(input), options);
}
