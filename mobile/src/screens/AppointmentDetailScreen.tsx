import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useAuth } from "../auth/AuthContext";
import {
  Appointment,
  ApiError,
  deleteEntity,
  listEntity,
  updateEntity,
} from "../api/adminApi";
import { colors, spacing, STATUS_LABELS } from "../theme";
import {
  ErrorBanner,
  Field,
  Label,
  LoadingBlock,
  PrimaryButton,
  Subtitle,
  Title,
} from "../components/ui";

const EMPTY = {
  patient_name: "",
  patient_phone: "",
  patient_email: "",
  treatment_name: "",
  treatment_price: "",
  date: "",
  time: "",
  notes: "",
  status: "pending",
  paid: false,
  marketing_consent: false,
};

export default function AppointmentDetailScreen() {
  const { token } = useAuth();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const id = String(route.params?.id || "");

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token || !id) return;
      setLoading(true);
      setError(null);
      try {
        const rows = await listEntity<Appointment>(token, "appointments", {
          order: "-created_at",
          limit: 1000,
        });
        const found = (rows || []).find((row) => row.id === id);
        if (!found) throw new ApiError("התור לא נמצא", 404);
        if (cancelled) return;
        setForm({
          patient_name: found.patient_name || "",
          patient_phone: found.patient_phone || "",
          patient_email: found.patient_email || "",
          treatment_name: found.treatment_name || "",
          treatment_price:
            found.treatment_price == null ? "" : String(found.treatment_price),
          date: found.date || "",
          time: found.time || "",
          notes: found.notes || "",
          status: found.status || "pending",
          paid: Boolean(found.paid),
          marketing_consent: Boolean(found.marketing_consent),
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "שגיאה בטעינה");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, id]);

  function setField<K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSave() {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await updateEntity(token, "appointments", id, {
        patient_name: form.patient_name.trim(),
        patient_phone: form.patient_phone.trim(),
        patient_email: form.patient_email.trim() || null,
        treatment_name: form.treatment_name.trim(),
        treatment_price:
          form.treatment_price === "" ? null : Number(form.treatment_price),
        date: form.date,
        time: form.time,
        notes: form.notes,
        status: form.status,
        paid: form.paid,
        marketing_consent: form.marketing_consent,
      });
      Alert.alert("נשמר", "התור עודכן בהצלחה");
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  function onDelete() {
    Alert.alert("מחיקת תור", "פעולה זו מוחקת את התור מהמערכת. להמשיך?", [
      { text: "ביטול", style: "cancel" },
      {
        text: "מחק",
        style: "destructive",
        onPress: async () => {
          if (!token) return;
          setSaving(true);
          try {
            await deleteEntity(token, "appointments", id);
            Alert.alert("נמחק", "התור נמחק");
            navigation.goBack();
          } catch (err) {
            setError(err instanceof Error ? err.message : "מחיקה נכשלה");
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  }

  if (loading) return <LoadingBlock />;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
    >
      <Title>פרטי תור</Title>
      <Subtitle>עריכה לפי אותם שדות כמו בפאנל הווב</Subtitle>
      <ErrorBanner message={error} />

      <Label>שם מטופל</Label>
      <Field value={form.patient_name} onChangeText={(v) => setField("patient_name", v)} />
      <Label>טלפון</Label>
      <Field
        value={form.patient_phone}
        onChangeText={(v) => setField("patient_phone", v)}
        keyboardType="phone-pad"
      />
      <Label>אימייל</Label>
      <Field
        value={form.patient_email}
        onChangeText={(v) => setField("patient_email", v)}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Label>טיפול</Label>
      <Field value={form.treatment_name} onChangeText={(v) => setField("treatment_name", v)} />
      <Label>מחיר</Label>
      <Field
        value={form.treatment_price}
        onChangeText={(v) => setField("treatment_price", v)}
        keyboardType="decimal-pad"
      />
      <Label>תאריך (YYYY-MM-DD)</Label>
      <Field value={form.date} onChangeText={(v) => setField("date", v)} />
      <Label>שעה (HH:MM)</Label>
      <Field value={form.time} onChangeText={(v) => setField("time", v)} />
      <Label>הערות</Label>
      <Field
        value={form.notes}
        onChangeText={(v) => setField("notes", v)}
        multiline
      />

      <Label>סטטוס</Label>
      <View style={styles.statusRow}>
        {Object.keys(STATUS_LABELS).map((key) => (
          <Text
            key={key}
            onPress={() => setField("status", key)}
            style={[
              styles.statusChip,
              form.status === key && styles.statusChipActive,
            ]}
          >
            {STATUS_LABELS[key]}
          </Text>
        ))}
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>שולם</Text>
        <Switch
          value={form.paid}
          onValueChange={(v) => setField("paid", v)}
          trackColor={{ true: colors.success, false: colors.clay }}
        />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>הסכמה לשיווק</Text>
        <Switch
          value={form.marketing_consent}
          onValueChange={(v) => setField("marketing_consent", v)}
          trackColor={{ true: colors.success, false: colors.clay }}
        />
      </View>

      <View style={{ gap: 10, marginTop: spacing.md }}>
        <PrimaryButton label="שמירה" onPress={() => void onSave()} loading={saving} />
        <PrimaryButton label="מחיקה" tone="danger" onPress={onDelete} disabled={saving} />
        <PrimaryButton label="חזרה" tone="outline" onPress={() => navigation.goBack()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  statusRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: spacing.md,
  },
  statusChip: {
    borderWidth: 1,
    borderColor: colors.clay,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.brownDark,
    overflow: "hidden",
    backgroundColor: colors.white,
  },
  statusChipActive: {
    backgroundColor: colors.brownDark,
    color: colors.white,
    borderColor: colors.brownDark,
  },
  switchRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  switchLabel: { color: colors.ink, fontSize: 16 },
});
