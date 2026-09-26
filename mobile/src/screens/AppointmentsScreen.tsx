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
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { format, addDays, subDays, parseISO, isValid } from "date-fns";
import { he } from "date-fns/locale";
import { useAuth } from "../auth/AuthContext";
import {
  Appointment,
  ApiError,
  listEntity,
  updateEntity,
} from "../api/adminApi";
import { colors, radii, spacing, STATUS_COLORS, STATUS_LABELS } from "../theme";
import {
  Card,
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PrimaryButton,
  Subtitle,
  Title,
} from "../components/ui";

function toDateKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export default function AppointmentsScreen() {
  const { token } = useAuth();
  const navigation = useNavigation<any>();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const dateKey = toDateKey(selectedDate);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const rows = await listEntity<Appointment>(token, "appointments", {
        order: "date",
        limit: 1000,
      });
      setItems(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "שגיאה בטעינת תורים");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  const dayItems = useMemo(() => {
    return items
      .filter((a) => a.date === dateKey)
      .filter((a) => (statusFilter === "all" ? true : a.status === statusFilter))
      .sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));
  }, [items, dateKey, statusFilter]);

  async function setStatus(id: string, status: string) {
    if (!token) return;
    setBusyId(id);
    try {
      await updateEntity(token, "appointments", id, { status });
      await load();
    } catch (err) {
      Alert.alert("שגיאה", err instanceof Error ? err.message : "עדכון נכשל");
    } finally {
      setBusyId(null);
    }
  }

  async function togglePaid(item: Appointment) {
    if (!token) return;
    setBusyId(item.id);
    try {
      await updateEntity(token, "appointments", item.id, { paid: !item.paid });
      await load();
    } catch (err) {
      Alert.alert("שגיאה", err instanceof Error ? err.message : "עדכון נכשל");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Title>תורים</Title>
        <Subtitle>יומן יומי · נתוני הפרודקשן של /booking/admin</Subtitle>
      </View>

      <View style={styles.dateRow}>
        <Pressable
          onPress={() => setSelectedDate((d) => addDays(d, 1))}
          style={styles.dateNav}
        >
          <Text style={styles.dateNavText}>◀</Text>
        </Pressable>
        <View style={styles.dateCenter}>
          <Text style={styles.dateMain}>
            {format(selectedDate, "EEEE, d בMMMM", { locale: he })}
          </Text>
          <Text style={styles.dateSub}>{dateKey}</Text>
        </View>
        <Pressable
          onPress={() => setSelectedDate((d) => subDays(d, 1))}
          style={styles.dateNav}
        >
          <Text style={styles.dateNavText}>▶</Text>
        </Pressable>
      </View>

      <View style={styles.filters}>
        {["all", "pending", "confirmed", "completed", "cancelled"].map((key) => (
          <Pressable
            key={key}
            onPress={() => setStatusFilter(key)}
            style={[styles.chip, statusFilter === key && styles.chipActive]}
          >
            <Text
              style={[
                styles.chipText,
                statusFilter === key && styles.chipTextActive,
              ]}
            >
              {key === "all" ? "הכל" : STATUS_LABELS[key]}
            </Text>
          </Pressable>
        ))}
      </View>

      <ErrorBanner message={error} />

      {loading ? (
        <LoadingBlock />
      ) : (
        <FlatList
          data={dayItems}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
          ListEmptyComponent={<EmptyState message="אין תורים ביום זה" />}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => {
            const statusColor = STATUS_COLORS[item.status] || colors.muted;
            return (
              <Card>
                <Pressable
                  onPress={() =>
                    navigation.navigate("AppointmentDetail", { id: item.id })
                  }
                >
                  <View style={styles.rowTop}>
                    <Text style={styles.time}>{item.time}</Text>
                    <Text style={[styles.status, { color: statusColor }]}>
                      {STATUS_LABELS[item.status] || item.status}
                    </Text>
                  </View>
                  <Text style={styles.name}>{item.patient_name}</Text>
                  <Text style={styles.meta}>
                    {item.treatment_name}
                    {item.treatment_price != null
                      ? ` · ₪${Number(item.treatment_price).toLocaleString("he-IL")}`
                      : ""}
                  </Text>
                  <Text style={styles.meta}>{item.patient_phone}</Text>
                </Pressable>
                <View style={styles.actions}>
                  <PrimaryButton
                    label={item.paid ? "שולם" : "סמן כשולם"}
                    tone="outline"
                    onPress={() => void togglePaid(item)}
                    disabled={busyId === item.id}
                  />
                  {item.status !== "confirmed" && item.status !== "cancelled" ? (
                    <PrimaryButton
                      label="אשר"
                      onPress={() => void setStatus(item.id, "confirmed")}
                      disabled={busyId === item.id}
                    />
                  ) : null}
                  {item.status !== "cancelled" ? (
                    <PrimaryButton
                      label="בטל"
                      tone="danger"
                      onPress={() =>
                        Alert.alert("ביטול תור", "לבטל את התור?", [
                          { text: "לא", style: "cancel" },
                          {
                            text: "בטל תור",
                            style: "destructive",
                            onPress: () => void setStatus(item.id, "cancelled"),
                          },
                        ])
                      }
                      disabled={busyId === item.id}
                    />
                  ) : null}
                </View>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}

/** Validate ISO date helper kept for future date picker wiring. */
export function isDateKey(value: string) {
  const d = parseISO(value);
  return isValid(d);
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.md },
  header: { paddingTop: spacing.sm, marginBottom: spacing.sm },
  dateRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    marginBottom: spacing.sm,
  },
  dateNav: { paddingHorizontal: 16, paddingVertical: 8 },
  dateNavText: { fontSize: 18, color: colors.brownDark },
  dateCenter: { alignItems: "center" },
  dateMain: { fontSize: 16, fontWeight: "700", color: colors.ink },
  dateSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  filters: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: spacing.sm,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.clay,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
    justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.brownDark, borderColor: colors.brownDark },
  chipText: { color: colors.brownDark, fontWeight: "600" },
  chipTextActive: { color: colors.white },
  rowTop: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  time: { fontSize: 18, fontWeight: "700", color: colors.ink },
  status: { fontSize: 14, fontWeight: "700" },
  name: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "right",
  },
  meta: {
    marginTop: 4,
    color: colors.muted,
    textAlign: "right",
    writingDirection: "rtl",
  },
  actions: {
    marginTop: spacing.sm,
    gap: 8,
  },
});
