import { useEffect } from "react";
import { demoModeEnabled } from "@/api/demoClient";
import { getDemoBrand } from "@/lib/demoBrand";

export default function DemoDocumentTitle() {
  useEffect(() => {
    if (!demoModeEnabled) return;
    const { clinicTitle } = getDemoBrand();
    document.title = clinicTitle;
  }, []);

  return null;
}
