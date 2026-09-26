import React, { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { WEBSITE_ADMIN_URL } from "../api/adminApi";
import { colors, spacing } from "../theme";
import { ErrorBanner, Subtitle, Title } from "../components/ui";

/**
 * Temporary WebView for website CMS.
 * Reason: ofirbaby.com/admin is a separate Next.js app with Server Actions and a
 * different Supabase project. Its source/CMS REST API are not in this workspace,
 * so native screens cannot safely reuse server validation/publishing without a
 * website-side API. The WebView preserves existing auth + publish behavior.
 */
export default function WebsiteAdminScreen() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const uri = useMemo(() => WEBSITE_ADMIN_URL, []);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Title>אתר</Title>
        <Subtitle>
          ניהול תוכן ומדיה דרך /admin הקיים (WebView זמני — ראו ARCHITECTURE.md)
        </Subtitle>
      </View>
      <ErrorBanner message={error} />
      <View style={styles.webWrap}>
        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.brownDark} />
            <Text style={styles.loadingText}>טוען את ניהול האתר…</Text>
          </View>
        ) : null}
        <WebView
          source={{ uri }}
          style={styles.webview}
          onLoadStart={() => {
            setLoading(true);
            setError(null);
          }}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError("לא ניתן לטעון את ניהול האתר. בדקו חיבור לרשת.");
          }}
          onHttpError={() => {
            setError("שגיאת שרת בטעינת ניהול האתר");
          }}
          startInLoadingState
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
          allowsBackForwardNavigationGestures
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  webWrap: {
    flex: 1,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    overflow: "hidden",
  },
  webview: { flex: 1, backgroundColor: colors.white },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(247,241,234,0.92)",
    gap: 10,
  },
  loadingText: { color: colors.muted },
});
