import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Save, Trash2, RotateCcw, ChevronRight, ChevronLeft, CalendarDays, CalendarRange } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { restoreDefaultAvailability, clearAvailabilityClearedMark } from "@/lib/mayaBootstrap";
import { ALL_SLOTS, DAY_NAMES } from "@/lib/weeklySchedule";
import WeeklyScheduleEditor from "@/components/admin/WeeklyScheduleEditor";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isBefore, startOfDay } from "date-fns";
import { he } from "date-fns/locale";
import { filterByClinicTenant, getClinicSite } from "@/lib/clinicSite";
import { clinicGlassPanel, clinicPrimaryBtn } from "@/lib/clinicUi";

export default function AvailabilityManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const clinicSite = getClinicSite();
  const [viewMode, setViewMode] = useState("calendar");
  const [viewMonth, setViewMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const { data: availabilityRecords = [], isLoading } = useQuery({
    queryKey: ["availability"],
    queryFn: () => base44.entities.Availability.list(),
  });

  const clinicAvailabilityRecords = useMemo(
    () => filterByClinicTenant(availabilityRecords, clinicSite),
    [availabilityRecords, clinicSite]
  );

  const today = startOfDay(new Date());

  const availMap = useMemo(() => {
    const m = {};
    clinicAvailabilityRecords.forEach((r) => { if (r.date) m[r.date] = r; });
    return m;
  }, [clinicAvailabilityRecords]);

  const daysInMonth = useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(viewMonth), end: endOfMonth(viewMonth) });
  }, [viewMonth]);

  const firstDayOffset = startOfMonth(viewMonth).getDay();

  const selectedRecord = selectedDate ? availMap[selectedDate] : null;
  const [editSlots, setEditSlots] = useState([]);

  useEffect(() => {
    if (selectedDate) {
      setEditSlots(availMap[selectedDate]?.slots || []);
    }
  }, [selectedDate, clinicAvailabilityRecords]);

  const toggleSlot = (slot) => {
    setEditSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot].sort()
    );
  };

  const handleSave = async () => {
    if (!selectedDate) return;
    setSaving(true);
    try {
      const payload = { date: selectedDate, slots: editSlots, is_active: editSlots.length > 0 };
      if (selectedRecord?.id) {
        await base44.entities.Availability.update(selectedRecord.id, payload);
      } else {
        await base44.entities.Availability.create(payload);
      }
      clearAvailabilityClearedMark();
      await queryClient.invalidateQueries({ queryKey: ["availability"] });
      toast({ title: `נשמר ל-${selectedDate}` });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRecord?.id) return;
    setSaving(true);
    try {
      await base44.entities.Availability.delete(selectedRecord.id);
      await queryClient.invalidateQueries({ queryKey: ["availability"] });
      setSelectedDate(null);
      toast({ title: "התאריך נמחק" });
    } finally {
      setSaving(false);
    }
  };

  const handleResetAll = async () => {
    if (!clinicSite) return;
    setSaving(true);
    try {
      const { restored, removed } = await restoreDefaultAvailability(base44, clinicSite);
      await queryClient.invalidateQueries({ queryKey: ["availability"] });
      setSelectedDate(null);
      setEditSlots(clinicSite.defaultSlots || []);
      toast({
        title: "שעות ברירת המחדל שוחזרו",
        description: `${restored} ימים עודכנו${removed > 0 ? `, ${removed} ימים עתידיים הוסרו` : ""}. שעות: ${(clinicSite.defaultSlots || []).join(", ")}`,
      });
    } finally {
      setSaving(false);
      setResetDialogOpen(false);
    }
  };

  const activeDayCount = useMemo(
    () => clinicAvailabilityRecords.filter((r) => r.slots?.length > 0).length,
    [clinicAvailabilityRecords]
  );

  const viewTabs = [
    { value: "calendar", label: "לוח חודשי", icon: CalendarDays },
    { value: "weekly", label: "לוז שבועי", icon: CalendarRange },
  ];

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <Tabs value={viewMode} onValueChange={setViewMode} dir="rtl">
        <div
          className={`mb-6 grid w-full grid-cols-2 gap-2 rounded-xl border p-2 ${
            clinicSite ? clinicGlassPanel : "border-border/60 bg-card"
          }`}
          role="tablist"
          aria-label="סוג ניהול זמינות"
        >
          {viewTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={viewMode === tab.value}
              onClick={() => setViewMode(tab.value)}
              className={`flex h-12 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-all ${
                viewMode === tab.value
                  ? clinicSite
                    ? `border-transparent ${clinicPrimaryBtn} !h-12 !px-3 !py-2 text-sm`
                    : "border-primary/30 bg-primary text-primary-foreground shadow-md"
                  : clinicSite
                    ? "border-transparent bg-white text-[#2F3B34] hover:bg-[#F7F8F6]"
                    : "border-transparent bg-muted/40 text-foreground hover:bg-muted"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <TabsContent value="calendar" className="space-y-6 mt-0">
          <div className="flex items-center justify-between gap-3" dir="rtl">
            <p className="text-sm text-muted-foreground">
              {activeDayCount > 0
                ? `${activeDayCount} ימים עם שעות פנויות`
                : "אין שעות פנויות — לא ניתן לקבוע תורים"}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving || !clinicSite}
              onClick={() => setResetDialogOpen(true)}
              className="gap-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/40 shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
              שחזור שעות ברירת מחדל
            </Button>
          </div>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-4" dir="rtl">
              <button type="button" onClick={() => setViewMonth(subMonths(viewMonth, 1))} className="p-1 rounded-lg hover:bg-muted">
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="font-semibold">{format(viewMonth, "MMMM yyyy", { locale: he })}</span>
              <button type="button" onClick={() => setViewMonth(addMonths(viewMonth, 1))} className="p-1 rounded-lg hover:bg-muted">
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 mb-1">
              {DAY_NAMES.map((d) => (
                <div key={d} className="text-center text-xs text-muted-foreground py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`e-${i}`} />)}
              {daysInMonth.map((date) => {
                const dateStr = format(date, "yyyy-MM-dd");
                const isPast = isBefore(date, today);
                const hasSlots = availMap[dateStr]?.slots?.length > 0;
                const isSelected = selectedDate === dateStr;
                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => !isPast && setSelectedDate(dateStr)}
                    disabled={isPast}
                    className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm m-0.5 transition-all font-medium relative
                      ${isSelected ? "bg-primary text-primary-foreground" : ""}
                      ${!isSelected && !isPast ? "hover:bg-accent text-foreground" : ""}
                      ${isPast ? "text-muted-foreground/30 cursor-not-allowed" : ""}
                    `}
                  >
                    {date.getDate()}
                    {hasSlots && !isSelected && (
                      <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          {selectedDate && (
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">
                  {format(new Date(selectedDate + "T00:00:00"), "EEEE, d בMMMM yyyy", { locale: he })}
                </h3>
                {selectedRecord?.id && (
                  <Button variant="ghost" size="sm" onClick={handleDelete} disabled={saving} className="text-destructive hover:text-destructive gap-1">
                    <Trash2 className="w-4 h-4" />
                    מחק
                  </Button>
                )}
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-3">בחרי שעות פנויות:</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_SLOTS.map((slot) => {
                    const sel = editSlots.includes(slot);
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => toggleSlot(slot)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                          sel
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border hover:border-primary/40"
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>

              {editSlots.length > 0 && (
                <Badge variant="secondary">{editSlots.length} שעות נבחרו</Badge>
              )}

              <Button onClick={handleSave} disabled={saving} className="w-full gap-2 rounded-xl">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                שמור
              </Button>
            </Card>
          )}

          {!selectedDate && (
            <p className="text-center text-muted-foreground text-sm py-4">בחרי תאריך בלוח השנה כדי להגדיר שעות</p>
          )}
        </TabsContent>

        <TabsContent value="weekly" className="mt-0">
          <WeeklyScheduleEditor availabilityRecords={clinicAvailabilityRecords} />
        </TabsContent>
      </Tabs>

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>לשחזר שעות ברירת מחדל?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תעדכן את 30 הימים הבאים לשעות ברירת המחדל של מאיה:
              {" "}
              {(clinicSite?.defaultSlots || []).join(", ")}.
              ימים עתידיים אחרים של מאיה (מחוץ לטווח) יוסרו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>ביטול</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
              onClick={(event) => {
                event.preventDefault();
                handleResetAll();
              }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              שחזור שעות
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
