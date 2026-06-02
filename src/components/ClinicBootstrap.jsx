import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44, backendMode } from "@/api/base44Client";
import { getClinicSite } from "@/lib/clinicSite";
import { ensureClinicSeedData } from "@/lib/mayaBootstrap";
import { supabaseConfigured } from "@/api/supabase";
import { useToast } from "@/components/ui/use-toast";

const BOOTSTRAP_ERROR_KEY = "clinic-bootstrap-error-shown";
const BOOTSTRAP_LOCAL_INFO_KEY = "clinic-bootstrap-local-info-shown";

function isLocalDevHost() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1";
}

function getBootstrapFailureMessage() {
  if (isLocalDevHost()) {
    return {
      title: "לא הצלחנו לשחזר הגדרות אוטומטית",
      description:
        "בדקי ש-VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY מוגדרים ב-.env.local, וש-schema.sql הורץ ב-Supabase.",
    };
  }

  return {
    title: "לא הצלחנו לשחזר הגדרות אוטומטית",
    description:
      "בדקי ש-Supabase מחובר בפרויקט Vercel של מאיה (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).",
  };
}

export default function ClinicBootstrap() {
  const ranRef = useRef(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const site = getClinicSite();
    if (!site || ranRef.current) return;
    if (backendMode === "demo") return;

    if (backendMode !== "supabase") {
      if (
        isLocalDevHost() &&
        !supabaseConfigured &&
        !sessionStorage.getItem(BOOTSTRAP_LOCAL_INFO_KEY)
      ) {
        sessionStorage.setItem(BOOTSTRAP_LOCAL_INFO_KEY, "1");
        toast({
          title: "פיתוח מקומי",
          description:
            "לחיבור ל-Supabase, הגדרי VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY בקובץ .env.local.",
        });
      }
      return;
    }

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
        if (sessionStorage.getItem(BOOTSTRAP_ERROR_KEY)) return;
        sessionStorage.setItem(BOOTSTRAP_ERROR_KEY, "1");

        const { title, description } = getBootstrapFailureMessage();
        toast({ title, description });
      });
  }, [queryClient, toast]);

  return null;
}
