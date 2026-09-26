import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../auth/AuthContext";
import {
  ApiError,
  Treatment,
  createEntity,
  deleteEntity,
  listEntity,
  updateEntity,
} from "../api/adminApi";
import { colors, radii, spacing } from "../theme";
import {
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Label,
  LoadingBlock,
  PrimaryButton,
  Subtitle,
  Title,
} from "../components/ui";

const emptyForm = {
  name: "",
  description: "",
  duration_minutes: "60",
  price: "",
  paybox_link: "",
};

export default function TreatmentsScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Treatment | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const rows = await listEntity<Treatment>(token, "treatments", {
        order: "name",
        limit: 500,
      });
      setItems(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "שגיאה בטעינת טיפולים");
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

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(item: Treatment) {
    setEditing(item);
    setForm({
      name: item.name || "",
      description: item.description || "",
      duration_minutes: String(item.duration_minutes ?? 60),
      price: item.price != null ? String(item.price) : "",
      paybox_link: item.paybox_link || "",
    });
    setModalOpen(true);
  }

  async function save() {
    if (!token) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        duration_minutes: Number.parseInt(form.duration_minutes, 10),
        price: Number.parseFloat(form.price),
        paybox_link: form.paybox_link.trim() || null,
      };
      if (!payload.name) throw new Error("שם טיפול חובה");
      if (!Number.isFinite(payload.duration_minutes) || payload.duration_minutes <= 0) {
        throw new Error("משך לא תקין");
      }
      if (!Number.isFinite(payload.price) || payload.price < 0) {
        throw new Error("מחיר לא תקין");
      }
      if (editing) {
        await updateEntity(token, "treatments", editing.id, payload);
      } else {
        await createEntity(token, "treatments", payload);
      }
      setModalOpen(false);
      await load();
      Alert.alert("נשמר", "הטיפול עודכן");
    } catch (err) {
      Alert.alert("שגיאה", err instanceof Error ? err.message : "שמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(item: Treatment) {
    Alert.alert("מחיקת טיפול", `למחוק את "${item.name}"?`, [
      { text: "ביטול", style: "cancel" },
      {
        text: "מחק",
        style: "destructive",
        onPress: async () => {
          if (!token) return;
          try {
            await deleteEntity(token, "treatments", item.id);
            await load();
          } catch (err) {
            Alert.alert("שגיאה", err instanceof Error ? err.message : "מחיקה נכשלה");
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Title>טיפולים</Title>
          <Subtitle>ניהול מחירון ומשך טיפול</Subtitle>
        </View>
        <PrimaryButton label="טיפול חדש" onPress={openCreate} />
      </View>
      <ErrorBanner message={error} />
      {loading ? (
        <LoadingBlock />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} />}
          ListEmptyComponent={<EmptyState message="אין טיפולים" />}
          renderItem={({ item }) => (
            <Card>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.duration_minutes} דק׳ · ₪{Number(item.price).toLocaleString("he-IL")}
              </Text>
              {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
              <View style={styles.actions}>
                <PrimaryButton label="עריכה" tone="outline" onPress={() => openEdit(item)} />
                <PrimaryButton label="מחיקה" tone="danger" onPress={() => confirmDelete(item)} />
              </View>
            </Card>
          )}
        />
      )}

      <Modal visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>{editing ? "עריכת טיפול" : "טיפול חדש"}</Text>
          <Label>שם</Label>
          <Field value={form.name} onChangeText={(v) => setForm((p) => ({ ...p, name: v }))} />
          <Label>תיאור</Label>
          <Field
            value={form.description}
            onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
            multiline
          />
          <Label>משך (דקות)</Label>
          <Field
            value={form.duration_minutes}
            onChangeText={(v) => setForm((p) => ({ ...p, duration_minutes: v }))}
            keyboardType="number-pad"
          />
          <Label>מחיר</Label>
          <Field
            value={form.price}
            onChangeText={(v) => setForm((p) => ({ ...p, price: v }))}
            keyboardType="decimal-pad"
          />
          <Label>קישור PayBox</Label>
          <Field
            value={form.paybox_link}
            onChangeText={(v) => setForm((p) => ({ ...p, paybox_link: v }))}
            autoCapitalize="none"
          />
          <View style={{ gap: 10, marginTop: spacing.md }}>
            <PrimaryButton label="שמירה" onPress={() => void save()} loading={saving} />
            <PrimaryButton label="ביטול" tone="outline" onPress={() => setModalOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.md },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    marginBottom: spacing.sm,
  },
  name: { fontSize: 18, fontWeight: "700", color: colors.ink, textAlign: "right" },
  meta: { marginTop: 4, color: colors.muted, textAlign: "right" },
  desc: { marginTop: 8, color: colors.ink, textAlign: "right", writingDirection: "rtl" },
  actions: { marginTop: spacing.sm, gap: 8 },
  modal: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.lg,
    paddingTop: 56,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "right",
    marginBottom: spacing.md,
  },
});
