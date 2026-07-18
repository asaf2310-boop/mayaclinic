import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const DEFAULT_MANIFEST = "/manifest.json";
const ADMIN_MANIFEST = "/admin-manifest.json";

/**
 * When the user is on /admin, point the web app manifest at an admin-specific
 * start_url so Android "Add to Home Screen" opens management — not /book.
 */
export default function AdminPwaManifest() {
  const { pathname } = useLocation();
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]');
    if (!link) return;

    link.setAttribute("href", isAdminRoute ? ADMIN_MANIFEST : DEFAULT_MANIFEST);
  }, [isAdminRoute]);

  return null;
}
