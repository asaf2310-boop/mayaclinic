import { useEffect } from "react";
import { bookingBasePath } from "@/lib/bookingMount";
import { demoModeEnabled } from "@/api/demoClient";
import { getDemoBrand } from "@/lib/demoBrand";
import { getClinicSite } from "@/lib/clinicSite";

export default function DemoDocumentTitle() {
  useEffect(() => {
    if (bookingBasePath) { document.title = "קביעת טיפול | OfirBaby"; return; }
    const clinicSite = getClinicSite();
    if (clinicSite) {
      document.title = clinicSite.clinicTitle;
      return;
    }

    if (!demoModeEnabled) return;
    const { clinicTitle } = getDemoBrand();
    document.title = clinicTitle;
  }, []);

  return null;
}
