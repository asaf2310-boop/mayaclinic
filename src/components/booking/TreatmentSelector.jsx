import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Banknote, Check } from "lucide-react";

export default function TreatmentSelector({ treatments, selectedId, onSelect }) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-semibold text-foreground">בחרו טיפול *</label>
      <div className="grid gap-3">
        {treatments.map((t) => {
          const isSelected = selectedId === t.id;
          return (
            <Card
              key={t.id}
              onClick={() => onSelect(t)}
              className={`cursor-pointer p-4 transition-all duration-300 ${
                isSelected
                  ? "border-primary bg-accent ring-1 ring-primary/20"
                  : "border-border/60 hover:border-primary/30 hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{t.icon || "✦"}</span>
                  <div>
                    <p className="font-semibold text-foreground">{t.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {t.duration_minutes} דקות
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Banknote className="w-3 h-3" /> ₪{t.price}
                      </span>
                    </div>
                  </div>
                </div>
                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-primary-foreground" />
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