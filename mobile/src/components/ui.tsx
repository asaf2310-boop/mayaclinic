import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from "react-native";
import { colors, radii, spacing } from "../theme";

export function Screen({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.screen, style]} accessibilityLanguage="he">
      {children}
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Field(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      placeholderTextColor={colors.muted}
      style={[styles.input, props.style, props.multiline ? styles.inputMultiline : null]}
      textAlign="right"
    />
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  tone = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: "primary" | "danger" | "outline";
}) {
  const toneStyle =
    tone === "danger"
      ? styles.btnDanger
      : tone === "outline"
        ? styles.btnOutline
        : styles.btnPrimary;
  const textStyle =
    tone === "outline" ? styles.btnOutlineText : styles.btnText;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        toneStyle,
        (disabled || loading) && styles.btnDisabled,
        pressed && !disabled && styles.btnPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tone === "outline" ? colors.brownDark : colors.white} />
      ) : (
        <Text style={textStyle}>{label}</Text>
      )}
    </Pressable>
  );
}

export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

export function LoadingBlock() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.brownDark} />
      <Text style={styles.loadingText}>טוען…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "right",
    writingDirection: "rtl",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: colors.muted,
    textAlign: "right",
    writingDirection: "rtl",
  },
  label: {
    fontSize: 13,
    color: colors.brown,
    marginBottom: 6,
    textAlign: "right",
    writingDirection: "rtl",
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.clay,
    backgroundColor: colors.white,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  btn: {
    minHeight: 48,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  btnPrimary: { backgroundColor: colors.brownDark },
  btnDanger: { backgroundColor: colors.danger },
  btnOutline: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.clay,
  },
  btnText: { color: colors.white, fontSize: 16, fontWeight: "600" },
  btnOutlineText: { color: colors.brownDark, fontSize: 16, fontWeight: "600" },
  btnDisabled: { opacity: 0.55 },
  btnPressed: { opacity: 0.88 },
  errorBox: {
    backgroundColor: "#F8E8E8",
    borderColor: "#E2B4B4",
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorText: { color: colors.danger, textAlign: "right", writingDirection: "rtl" },
  empty: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: { color: colors.muted, fontSize: 15, textAlign: "center" },
  loading: {
    paddingVertical: 48,
    alignItems: "center",
    gap: 10,
  },
  loadingText: { color: colors.muted },
});
