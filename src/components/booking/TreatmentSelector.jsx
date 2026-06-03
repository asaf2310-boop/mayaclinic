import React from "react";
import { Card } from "@/components/ui/card";
import { Clock, Banknote, Check } from "lucide-react";
import { getClinicSite } from "@/lib/clinicSite";
import {
  clinicFormLabel,
  clinicTextHeading,
  clinicTextMuted,
  clinicTextPrimary,
  clinicTreatmentCard,
  clinicTreatmentCardSelected,
  clinicTreatmentCheck,
} from "@/lib/clinicUi";

export default function TreatmentSelector({ treatments, selectedId, onSelect }) {
  const clinicSite = getClinicSite();

  return (
    <div className="space-y-3">
      <label className={clinicSite ? clinicFormLabel : "text-sm font-semibold text-foreground"}>
        בחרו טיפול *
      </label>
      <div className="grid gap-3">
        {treatments.map((t) => {
          const isSelected = selectedId === t.id;
          return (
            <Card
              key={t.id}
              onClick={() => onSelect(t)}
              className={
                clinicSite
                  ? isSelected
                    ? clinicTreatmentCardSelected
                    : clinicTreatmentCard
                  : `cursor-pointer p-4 transition-all duration-300 ${
                      isSelected
                        ? "border-primary bg-accent ring-1 ring-primary/20"
                        : "border-border/60 hover:border-primary/30 hover:bg-muted/30"
                    }`
              }
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{t.icon || "✦"}</span>
                  <div>
                    <p className={`font-semibold ${clinicSite ? clinicTextHeading : "text-foreground"}`}>
                      {t.name}
                    </p>
                    <div className="mt-1 flex items-center gap-3">
                      <span
                        className={`flex items-center gap-1 text-xs ${
                          clinicSite ? clinicTextMuted : "text-muted-foreground"
                        }`}
                      >
                        <Clock className="h-3 w-3" /> {t.duration_minutes} דקות
                      </span>
                      <span
                        className={`flex items-center gap-1 text-xs ${
                          clinicSite ? clinicTextPrimary : "text-muted-foreground"
                        }`}
                      >
                        <Banknote className="h-3 w-3" /> ₪{t.price}
                      </span>
                    </div>
                  </div>
                </div>
                {isSelected && (
                  <div
                    className={
                      clinicSite
                        ? clinicTreatmentCheck
                        : "flex h-6 w-6 items-center justify-center rounded-full bg-primary"
                    }
                  >
                    <Check
                      className={`h-3.5 w-3.5 ${
                        clinicSite ? "text-white" : "text-primary-foreground"
                      }`}
                    />
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
