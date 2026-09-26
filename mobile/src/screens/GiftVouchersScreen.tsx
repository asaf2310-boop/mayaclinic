import React, { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../auth/AuthContext";
import { ApiError, GiftVoucher, listEntity } from "../api/adminApi";
import { colors, spacing } from "../theme";
import {
  Card,
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  Subtitle,
  Title,
} from "../components/ui";

export default function GiftVouchersScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<GiftVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const rows = await listEntity<GiftVoucher>(token, "gift_vouchers", {
        order: "-created_at",
        limit: 500,
      });
      setItems(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "שגיאה בטעינת שוברים");
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

  return (
    <View style={styles.root}>
      <Title>שוברי מתנה</Title>
      <Subtitle>צפייה בלבד — כמו בפאנל הווב</Subtitle>
      <ErrorBanner message={error} />
      {loading ? (
        <LoadingBlock />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} />}
          ListEmptyComponent={<EmptyState message="אין שוברים" />}
          renderItem={({ item }) => (
            <Card>
              <Text style={styles.code}>{item.code}</Text>
              <Text style={styles.meta}>מזמין: {item.purchaser_name || "—"}</Text>
              <Text style={styles.meta}>מטופל: {item.recipient_name || "—"}</Text>
              <Text style={styles.meta}>
                יתרה {item.treatments_remaining ?? "—"}/{item.treatments_total ?? "—"} ·{" "}
                {item.status || "—"}
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
  code: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "left",
    writingDirection: "ltr",
  },
  meta: { marginTop: 4, color: colors.muted, textAlign: "right", writingDirection: "rtl" },
});
