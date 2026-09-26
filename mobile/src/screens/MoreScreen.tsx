import React from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../auth/AuthContext";
import { colors, spacing } from "../theme";
import { Card, PrimaryButton, Subtitle, Title } from "../components/ui";

export default function MoreScreen() {
  const { email, tenantId, logout } = useAuth();
  const navigation = useNavigation<any>();

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: spacing.md }}>
      <Title>עוד</Title>
      <Subtitle>כלים נוספים לניהול יומיומי</Subtitle>

      <Card>
        <Text style={styles.label}>משתמש תורים</Text>
        <Text style={styles.value}>{email || "סיסמת אדמין"}</Text>
        <Text style={styles.label}>Tenant</Text>
        <Text style={styles.value}>{tenantId || "—"}</Text>
      </Card>

      <View style={{ gap: 10 }}>
        <PrimaryButton
          label="זמינות"
          tone="outline"
          onPress={() => navigation.navigate("Availability")}
        />
        <PrimaryButton
          label="טיפולים"
          tone="outline"
          onPress={() => navigation.navigate("Treatments")}
        />
        <PrimaryButton
          label="לקוחות"
          tone="outline"
          onPress={() => navigation.navigate("Customers")}
        />
        <PrimaryButton
          label="שוברי מתנה"
          tone="outline"
          onPress={() => navigation.navigate("GiftVouchers")}
        />
        <PrimaryButton
          label="התנתקות"
          tone="danger"
          onPress={() =>
            Alert.alert("התנתקות", "להתנתק מניהול התורים?", [
              { text: "ביטול", style: "cancel" },
              { text: "התנתק", style: "destructive", onPress: () => void logout() },
            ])
          }
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  label: { color: colors.muted, textAlign: "right", marginTop: 8 },
  value: {
    color: colors.ink,
    fontWeight: "600",
    textAlign: "right",
    writingDirection: "rtl",
  },
});
