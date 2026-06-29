import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44, backendMode } from "@/api/base44Client";
import { getClinicSite } from "@/lib/clinicSite";
import {
  ensureClinicSeedData,
  restoreDefaultAvailability,
  verifyClinicBackend,
} from "@/lib/mayaBootstrap";
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

async function showBootstrapFailureToast(toast) {
  if (sessionStorage.getItem(BOOTSTRAP_ERROR_KEY)) return;
  sessionStorage.setItem(BOOTSTRAP_ERROR_KEY, "1");

  const { title, description } = getBootstrapFailureMessage();
  toast({ title, description });
}

export default function ClinicBootstrap() {
  const ranRef = useRef(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const site = getClinicSite();
    if (site) {
      document.body.classList.add("clinic-site");
    } else {
      document.body.classList.remove("clinic-site");
    }
    return () => document.body.classList.remove("clinic-site");
  }, []);

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

    const params = new URLSearchParams(window.location.search);
    const shouldRestoreAvailability = params.get("restoreAvailability") === "1";

    const runBootstrap = shouldRestoreAvailability
      ? restoreDefaultAvailability(base44, site).then(({ restored, removed }) => ({
          restoredTreatments: 0,
          restoredAvailability: restored,
          removedAvailability: removed,
          coreOk: true,
          seedErrors: [],
        }))
      : ensureClinicSeedData(base44);

    runBootstrap
      .then(async ({
        restoredTreatments,
        restoredAvailability,
        removedAvailability = 0,
        coreOk = true,
      }) => {
        if (!coreOk) {
          await showBootstrapFailureToast(toast);
          return;
        }

        if (shouldRestoreAvailability) {
          params.delete("restoreAvailability");
          const nextSearch = params.toString();
          const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
          window.history.replaceState({}, "", nextUrl);
        }

        if (restoredTreatments > 0) {
          queryClient.invalidateQueries({ queryKey: ["treatments"] });
        }
        if (restoredAvailability > 0) {
          queryClient.invalidateQueries({ queryKey: ["availability"] });
        }
        if (shouldRestoreAvailability) {
          queryClient.invalidateQueries({ queryKey: ["weekly-schedule"] });
        }

        if (shouldRestoreAvailability && restoredAvailability > 0) {
          toast({
            title: "שעות ברירת המחדל שוחזרו",
            description: `${restoredAvailability} ימים עודכנו${removedAvailability > 0 ? `, ${removedAvailability} ימים הוסרו` : ""}.`,
          });
          return;
        }

        if (restoredTreatments > 0 || restoredAvailability > 0) {
          toast({
            title: "שוחזרו הגדרות קליניקה",
            description: `טיפולים: ${restoredTreatments}, זמינות: ${restoredAvailability}`,
          });
        }
      })
      .catch(async () => {
        const coreOk = await verifyClinicBackend(base44);
        if (coreOk) return;

        await showBootstrapFailureToast(toast);
      });
  }, [queryClient, toast]);

  return null;
}
