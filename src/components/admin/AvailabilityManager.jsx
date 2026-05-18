import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Trash2, Plus, ChevronRight, ChevronLeft } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isBefore, startOfDay, isSameDay } from "date-fns";
import { he } from "date-fns/locale";

const ALL_SLOTS = [
  "08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
  "12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30",
  "16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30",
];

const DAY_NAMES = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

export default function AvailabilityManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [viewMonth, setViewMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null); // date string yyyy-MM-dd
  const [saving, setSaving] = useState(false);

  const { data: availabilityRecords = [], isLoading } = useQuery({
    queryKey: ["availability"],
    queryFn: () => base44.entities.Availability.list(),
  });

  const today = startOfDay(new Date());

  // Map: dateStr -> record
  const availMap = useMemo(() => {
    const m = {};
    availabilityRecords.forEach((r) => { if (r.date) m[r.date] = r; });
    return m;
  }, [availabilityRecords]);

  const daysInMonth = useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(viewMonth), end: endOfMonth(viewMonth) });
  }, [viewMonth]);

  const firstDayOffset = startOfMonth(viewMonth).getDay();

  const selectedRecord = selectedDate ? availMap[selectedDate] : null;
  const [editSlots, setEditSlots] = useState([]);

  // When selected date changes, sync editSlots
  useEffect(() => {
    if (selectedDate) {
      setEditSlots(availMap[selectedDate]?.slots || []);
    }
  }, [selectedDate, availabilityRecords]);

  const toggleSlot = (slot) => {
    setEditSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot].sort()
    );
  };

  const handleSave = async () => {
    if (!selectedDate) return;
    setSaving(true);
    const payload = { date: selectedDate, slots: editSlots, is_active: editSlots.length > 0 };
    if (selectedRecord?.id) {
      await base44.entities.Availability.update(selectedRecord.id, payload);
    } else {
      await base44.entities.Availability.create(payload);
    }
    await queryClient.invalidateQueries({ queryKey: ["availability"] });
    setSaving(false);
    toast({ title: `נשמר ל-${selectedDate}` });
  };

  const handleDelete = async () => {
    if (!selectedRecord?.id) return;
    setSaving(true);
    await base44.entities.Availability.delete(selectedRecord.id);
    await queryClient.invalidateQueries({ queryKey: ["availability"] });
    setSaving(false);
    setSelectedDate(null);
    toast({ title: "התאריך נמחק" });
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Calendar */}
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

      {/* Slot editor for selected date */}
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
    </div>
  );
}