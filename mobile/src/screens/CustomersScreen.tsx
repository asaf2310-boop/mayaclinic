import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../auth/AuthContext";
import { ApiError, Appointment, listEntity } from "../api/adminApi";
import { colors, spacing } from "../theme";
import {
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  LoadingBlock,
  Subtitle,
  Title,
} from "../components/ui";

type Customer = {
  key: string;
  name: string;
  phone: string;
  email: string;
  count: number;
  lastDate: string;
};

export default function CustomersScreen() {
  const { token } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const rows = await listEntity<Appointment>(token, "appointments", {
        order: "-date",
        limit: 1000,
      });
      setAppointments(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "שגיאה בטעינת לקוחות");
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

  const customers = useMemo(() => {
    const map = new Map<string, Customer>();
    for (const apt of appointments) {
      const phone = String(apt.patient_phone || "").trim();
      const key = phone || String(apt.patient_email || "").toLowerCase() || apt.id;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          name: apt.patient_name || "ללא שם",
          phone,
          email: apt.patient_email || "",
          count: 1,
          lastDate: apt.date || "",
        });
      } else {
        existing.count += 1;
        if ((apt.date || "") > existing.lastDate) existing.lastDate = apt.date || "";
        if (!existing.name && apt.patient_name) existing.name = apt.patient_name;
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "he"));
  }, [appointments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [customers, query]);

  return (
    <View style={styles.root}>
      <Title>לקוחות</Title>
      <Subtitle>מרוכזים מתוך היסטוריית התורים</Subtitle>
      <Field
        value={query}
        onChangeText={setQuery}
        placeholder="חיפוש לפי שם / טלפון / אימייל"
        style={{ marginTop: spacing.sm }}
      />
      <ErrorBanner message={error} />
      {loading ? (
        <LoadingBlock />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.key}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} />}
          ListEmptyComponent={<EmptyState message="אין לקוחות להצגה" />}
          renderItem={({ item }) => (
            <Card>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>{item.phone || "—"}</Text>
              {item.email ? <Text style={styles.meta}>{item.email}</Text> : null}
              <Text style={styles.meta}>
                {item.count} תורים · אחרון: {item.lastDate || "—"}
              </Text>
            </Card>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.md },
  name: { fontSize: 17, fontWeight: "700", color: colors.ink, textAlign: "right" },
  meta: { marginTop: 4, color: colors.muted, textAlign: "right", writingDirection: "rtl" },
});
