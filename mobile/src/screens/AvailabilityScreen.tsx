import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from "date-fns";
import { he } from "date-fns/locale";
import { useAuth } from "../auth/AuthContext";
import {
  ApiError,
  Availability,
  createEntity,
  listEntity,
  updateEntity,
} from "../api/adminApi";
import { colors, radii, spacing } from "../theme";
import {
  Card,
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PrimaryButton,
  Subtitle,
  Title,
} from "../components/ui";

const ALL_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00", "18:30", "19:00", "19:30",
  "20:00", "20:30", "21:00",
];

export default function AvailabilityScreen() {
  const { token } = useAuth();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [records, setRecords] = useState<Availability[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editSlots, setEditSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const rows = await listEntity<Availability>(token, "availability", {
        order: "date",
        limit: 1000,
      });
      setRecords(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "שגיאה בטעינת זמינות");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  const map = useMemo(() => {
    const m: Record<string, Availability> = {};
    records.forEach((r) => {
      if (r.date) m[r.date] = r;
    });
    return m;
  }, [records]);

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }),
    [month]
  );

  function selectDay(dateKey: string) {
    setSelectedDate(dateKey);
    setEditSlots([...(map[dateKey]?.slots || [])]);
  }

  function toggleSlot(slot: string) {
    setEditSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot].sort()
    );
  }

  async function save() {
    if (!token || !selectedDate) return;
    setSaving(true);
    setError(null);
    try {
      const existing = map[selectedDate];
      if (existing?.id) {
        await updateEntity(token, "availability", existing.id, {
          slots: editSlots,
          is_active: true,
          date: selectedDate,
        });
      } else {
        await createEntity(token, "availability", {
          date: selectedDate,
          slots: editSlots,
          is_active: true,
        });
      }
      Alert.alert("נשמר", "הזמינות עודכנה");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.root}>
      <Title>זמינות</Title>
      <Subtitle>אותם נתוני זמינות כמו בפאנל הווב</Subtitle>

      <View style={styles.monthRow}>
        <Pressable onPress={() => setMonth((m) => addMonths(m, 1))} style={styles.nav}>
          <Text style={styles.navText}>◀</Text>
        </Pressable>
        <Text style={styles.monthLabel}>
          {format(month, "MMMM yyyy", { locale: he })}
        </Text>
        <Pressable onPress={() => setMonth((m) => subMonths(m, 1))} style={styles.nav}>
          <Text style={styles.navText}>▶</Text>
        </Pressable>
      </View>

      <ErrorBanner message={error} />
      {loading ? (
        <LoadingBlock />
      ) : (
        <FlatList
          data={days}
          keyExtractor={(d) => format(d, "yyyy-MM-dd")}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={() => void load()} />
          }
          renderItem={({ item }) => {
            const key = format(item, "yyyy-MM-dd");
            const slots = map[key]?.slots || [];
            const selected = selectedDate === key;
            return (
              <Pressable
                onPress={() => selectDay(key)}
                style={[styles.dayRow, selected && styles.dayRowSelected]}
              >
                <Text style={[styles.dayLabel, selected && styles.dayLabelSelected]}>
                  {format(item, "EEEE d/M", { locale: he })}
                </Text>
                <Text style={[styles.dayMeta, selected && styles.dayLabelSelected]}>
                  {slots.length ? `${slots.length} שעות` : "אין זמינות"}
                </Text>
              </Pressable>
            );
          }}
          ListFooterComponent={
            selectedDate ? (
              <Card style={{ marginTop: spacing.md }}>
                <Text style={styles.selectedTitle}>זמינות ל־{selectedDate}</Text>
                <View style={styles.slots}>
                  {ALL_SLOTS.map((slot) => {
                    const on = editSlots.includes(slot);
                    return (
                      <Pressable
                        key={slot}
                        onPress={() => toggleSlot(slot)}
                        style={[styles.slot, on && styles.slotOn]}
                      >
                        <Text style={[styles.slotText, on && styles.slotTextOn]}>
                          {slot}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <PrimaryButton
                  label="שמירת זמינות"
                  onPress={() => void save()}
                  loading={saving}
                />
              </Card>
            ) : (
              <EmptyState message="בחרו תאריך לעריכת שעות" />
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.md },
  monthRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: spacing.sm,
  },
  nav: { padding: 10 },
  navText: { fontSize: 18, color: colors.brownDark },
  monthLabel: { fontSize: 18, fontWeight: "700", color: colors.ink },
  dayRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
    minHeight: 52,
  },
  dayRowSelected: {
    backgroundColor: colors.brownDark,
    borderColor: colors.brownDark,
  },
  dayLabel: { color: colors.ink, fontWeight: "700" },
  dayMeta: { color: colors.muted },
  dayLabelSelected: { color: colors.white },
  selectedTitle: {
    textAlign: "right",
    fontWeight: "700",
    fontSize: 16,
    marginBottom: spacing.sm,
    color: colors.ink,
  },
  slots: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: spacing.md,
  },
  slot: {
    minWidth: 72,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.clay,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  slotOn: { backgroundColor: colors.brownDark, borderColor: colors.brownDark },
  slotText: { color: colors.brownDark, fontWeight: "600" },
  slotTextOn: { color: colors.white },
});
