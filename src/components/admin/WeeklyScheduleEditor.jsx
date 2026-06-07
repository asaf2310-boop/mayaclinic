import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, CalendarRange, Save } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { clearAvailabilityClearedMark } from "@/lib/mayaBootstrap";
import {
  ALL_SLOTS,
  APPLY_DAY_OPTIONS,
  DAY_NAMES,
  DAY_NAMES_FULL,
  createEmptyWeeklyTemplate,
  normalizeWeeklyRecords,
  planWeeklyAvailabilityApply,
} from "@/lib/weeklySchedule";
import { getClinicSite } from "@/lib/clinicSite";
import { clinicOutlineBtn, clinicPrimaryBtn } from "@/lib/clinicUi";

function SlotGrid({ slots, onToggle, disabled }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ALL_SLOTS.map((slot) => {
        const selected = slots.includes(slot);
        return (
          <button
            key={slot}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(slot)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all disabled:opacity-50 ${
              selected
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-primary/40"
            }`}
          >
            {slot}
          </button>
        );
      })}
    </div>
  );
}

export default function WeeklyScheduleEditor({ availabilityRecords = [] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const clinicSite = getClinicSite();
  const [weekDays, setWeekDays] = useState(createEmptyWeeklyTemplate());
  const [expandedDay, setExpandedDay] = useState(0);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyDays, setApplyDays] = useState(30);

  const hasWeeklyEntity = Boolean(base44.entities.WeeklySchedule);

  const { data: weeklyRecords = [], isLoading } = useQuery({
    queryKey: ["weekly-schedule"],
    queryFn: () => base44.entities.WeeklySchedule?.list("day_of_week") ?? [],
    enabled: hasWeeklyEntity,
  });

  useEffect(() => {
    setWeekDays(normalizeWeeklyRecords(weeklyRecords));
  }, [weeklyRecords]);

  const activeDayCount = useMemo(
    () => weekDays.filter((day) => day.is_active && day.slots.length > 0).length,
    [weekDays]
  );

  const updateDay = (dayOfWeek, patch) => {
    setWeekDays((prev) =>
      prev.map((day) => (day.day_of_week === dayOfWeek ? { ...day, ...patch } : day))
    );
  };

  const toggleDaySlot = (dayOfWeek, slot) => {
    setWeekDays((prev) =>
      prev.map((day) => {
        if (day.day_of_week !== dayOfWeek) return day;
        const slots = day.slots.includes(slot)
          ? day.slots.filter((s) => s !== slot)
          : [...day.slots, slot].sort();
        return { ...day, slots, is_active: slots.length > 0 ? true : day.is_active };
      })
    );
  };

  const handleSaveTemplate = async () => {
    if (!hasWeeklyEntity) return;
    setSaving(true);
    try {
      const existingByDay = Object.fromEntries(
        weeklyRecords.map((row) => [Number(row.day_of_week), row])
      );

      await Promise.all(
        weekDays.map((day) => {
          const payload = {
            day_of_week: day.day_of_week,
            slots: day.slots,
            is_active: day.is_active && day.slots.length > 0,
          };
          const existing = existingByDay[day.day_of_week];
          if (existing?.id) {
            return base44.entities.WeeklySchedule.update(existing.id, payload);
          }
          return base44.entities.WeeklySchedule.create(payload);
        })
      );

      await queryClient.invalidateQueries({ queryKey: ["weekly-schedule"] });
      toast({ title: "לוז שבועי נשמר" });
    } finally {
      setSaving(false);
    }
  };

  const handleApply = async () => {
    if (!hasWeeklyEntity || activeDayCount === 0) return;
    setApplying(true);
    try {
      const normalized = normalizeWeeklyRecords(weekDays);
      const { toUpsert, toDelete } = planWeeklyAvailabilityApply(
        normalized,
        availabilityRecords,
        { daysAhead: applyDays }
      );

      await Promise.all([
        ...toUpsert.map((row) =>
          row.id
            ? base44.entities.Availability.update(row.id, {
                date: row.date,
                slots: row.slots,
                is_active: row.is_active,
              })
            : base44.entities.Availability.create({
                date: row.date,
                slots: row.slots,
                is_active: row.is_active,
              })
        ),
        ...toDelete.map((id) => base44.entities.Availability.delete(id)),
      ]);

      clearAvailabilityClearedMark();
      await queryClient.invalidateQueries({ queryKey: ["availability"] });
      toast({
        title: "לוז שבועי הוחל",
        description: `${toUpsert.length} ימים עודכנו ל-${applyDays} הימים הבאים.`,
      });
    } finally {
      setApplying(false);
    }
  };

  if (!hasWeeklyEntity) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        לוז שבועי אינו זמין במצב זה.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const primaryBtnClass = clinicSite ? clinicPrimaryBtn : undefined;
  const outlineBtnClass = clinicSite ? clinicOutlineBtn : undefined;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {activeDayCount > 0
            ? `${activeDayCount} ימים פעילים בלוז השבועי`
            : "הגדירי ימים ושעות — ואז החילי על התאריכים הבאים"}
        </p>
        <Badge variant="secondary">תבנית חוזרת</Badge>
      </div>

      <div className="space-y-3">
        {weekDays.map((day) => {
          const isExpanded = expandedDay === day.day_of_week;
          const dayActive = day.is_active && day.slots.length > 0;
          return (
            <Card key={day.day_of_week} className="overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 p-4 text-right hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedDay(day.day_of_week)}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      dayActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {DAY_NAMES[day.day_of_week]}
                  </span>
                  <div>
                    <p className="font-medium text-foreground">{DAY_NAMES_FULL[day.day_of_week]}</p>
                    <p className="text-xs text-muted-foreground">
                      {dayActive ? `${day.slots.length} שעות` : "לא פעיל"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={day.is_active}
                  onCheckedChange={(checked) => {
                    updateDay(day.day_of_week, {
                      is_active: checked,
                      slots: checked ? day.slots : [],
                    });
                    if (checked) setExpandedDay(day.day_of_week);
                  }}
                  onClick={(event) => event.stopPropagation()}
                  aria-label={`הפעלת ${DAY_NAMES_FULL[day.day_of_week]}`}
                />
              </button>

              {isExpanded && (
                <div className="border-t px-4 pb-4 pt-3 space-y-3">
                  <p className="text-sm text-muted-foreground">בחרי שעות פנויות:</p>
                  <SlotGrid
                    slots={day.slots}
                    disabled={saving || applying}
                    onToggle={(slot) => toggleDaySlot(day.day_of_week, slot)}
                  />
                  {day.slots.length > 0 && (
                    <Badge variant="secondary">{day.slots.length} שעות נבחרו</Badge>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          onClick={handleSaveTemplate}
          disabled={saving || applying}
          className={`flex-1 gap-2 rounded-xl ${primaryBtnClass || ""}`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          שמור לוז שבועי
        </Button>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <CalendarRange className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground">החל לוז שבועי</h3>
            <p className="text-sm text-muted-foreground">
              יוצר/מעדכן רשומות זמינות לפי התבנית השבועית. ניתן להחיל מחדש לאחר איפוס הכל.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {APPLY_DAY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setApplyDays(option.value)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                applyDays === option.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <Button
          type="button"
          onClick={handleApply}
          disabled={applying || saving || activeDayCount === 0}
          className={`w-full gap-2 rounded-xl ${outlineBtnClass || ""}`}
          variant={clinicSite ? "ghost" : "outline"}
        >
          {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarRange className="w-4 h-4" />}
          החל על {applyDays} יום הבאים
        </Button>
      </Card>
    </div>
  );
}
