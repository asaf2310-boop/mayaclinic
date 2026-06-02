import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44, backendMode } from "@/api/base44Client";
import { getClinicSite } from "@/lib/clinicSite";
import { ensureClinicSeedData } from "@/lib/mayaBootstrap";
import { useToast } from "@/components/ui/use-toast";

export default function ClinicBootstrap() {
  const ranRef = useRef(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const site = getClinicSite();
    if (!site || ranRef.current) return;
    if (backendMode === "demo") return;

    ranRef.current = true;

    ensureClinicSeedData(base44)
      .then(({ restoredTreatments, restoredAvailability }) => {
        if (restoredTreatments > 0) {
          queryClient.invalidateQueries({ queryKey: ["treatments"] });
        }
        if (restoredAvailability > 0) {
          queryClient.invalidateQueries({ queryKey: ["availability"] });
        }

        if (restoredTreatments > 0 || restoredAvailability > 0) {
          toast({
            title: "שוחזרו הגדרות קליניקה",
            description: `טיפולים: ${restoredTreatments}, זמינות: ${restoredAvailability}`,
          });
        }
      })
      .catch(() => {
        toast({
          title: "לא הצלחנו לשחזר הגדרות אוטומטית",
          description: "בדקי ש־Supabase מחובר בפרויקט Vercel של מאיה.",
          variant: "destructive",
        });
      });
  }, [queryClient, toast]);

  return null;
}
