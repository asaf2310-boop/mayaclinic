import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/adminApi";
import { colors, radii, spacing } from "../theme";
import { ErrorBanner, Field, Label, PrimaryButton, Subtitle, Title } from "../components/ui";

export default function LoginScreen() {
  const { login } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await login(password);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "ההתחברות נכשלה";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={styles.brand}>OfirBaby</Text>
          <Title>ניהול העסק</Title>
          <Subtitle>
            כניסה מאובטחת לניהול תורים. ניהול האתר זמין בלשונית נפרדת עם ההתחברות
            הקיימת של האתר.
          </Subtitle>
        </View>

        <View style={styles.form}>
          <ErrorBanner message={error} />
          <Label>סיסמת אדמין (תורים)</Label>
          <Field
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={onSubmit}
            placeholder="הזינו סיסמה"
          />
          <PrimaryButton
            label="כניסה"
            onPress={onSubmit}
            loading={loading}
            disabled={!password.trim()}
          />
          <Text style={styles.hint}>
            אותה סיסמת אדמין של /booking/admin. אין סיסמאות או מפתחות מוטמעים באפליקציה.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  hero: {
    marginBottom: spacing.xl,
  },
  brand: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.accent,
    textAlign: "right",
    marginBottom: spacing.sm,
    letterSpacing: 0.4,
  },
  form: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  hint: {
    marginTop: spacing.md,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
    writingDirection: "rtl",
  },
});
