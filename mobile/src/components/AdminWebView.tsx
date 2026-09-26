import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { isTrustedWebViewUrl } from "../config";
import { colors } from "../theme";

// react-native-webview typings are incomplete under RN 0.86 + strict mode.
const RNWebView = WebView as React.ComponentType<any>;

type Props = {
  startUrl: string;
  title: string;
  /** Called when this tab's WebView can/can't go back (for parent awareness). */
  onCanGoBackChange?: (canGoBack: boolean) => void;
  /** When true, Android hardware back is handled by this WebView. */
  isActive: boolean;
};

export default function AdminWebView({
  startUrl,
  title,
  onCanGoBackChange,
  isActive,
}: Props) {
  const webRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    onCanGoBackChange?.(canGoBack);
  }, [canGoBack, onCanGoBackChange]);

  useEffect(() => {
    if (!isActive) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack && webRef.current) {
        webRef.current.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [isActive, canGoBack]);

  const openExternal = useCallback(async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
    } catch {
      // ignore
    }
  }, []);

  const onShouldStartLoadWithRequest = useCallback(
    (request: { url?: string }) => {
      const url = String(request.url || "");
      if (!url || url === "about:blank") return true;

      // Allow blob/data for previews inside admin
      if (url.startsWith("blob:") || url.startsWith("data:")) return true;

      if (isTrustedWebViewUrl(url)) return true;

      // Tel / mailto / unknown https → external
      void openExternal(url);
      return false;
    },
    [openExternal]
  );

  const onNavChange = useCallback((nav: { canGoBack?: boolean }) => {
    setCanGoBack(Boolean(nav.canGoBack));
  }, []);

  const reload = useCallback(() => {
    setError(null);
    setLoading(true);
    webRef.current?.reload();
  }, []);

  return (
    <View style={styles.root} accessibilityLanguage="he">
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.headerActions}>
          {canGoBack ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => webRef.current?.goBack()}
              style={styles.headerBtn}
            >
              <Text style={styles.headerBtnText}>חזרה</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" onPress={reload} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>רענון</Text>
          </Pressable>
        </View>
      </View>

      {loading && !error ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressBar, { width: `${Math.max(8, progress * 100)}%` }]} />
        </View>
      ) : (
        <View style={styles.progressSpacer} />
      )}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>לא ניתן לטעון את הדף</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <Pressable onPress={reload} style={styles.retryBtn}>
            <Text style={styles.retryText}>נסה שוב</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.webWrap}>
        {loading && !error ? (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color={colors.brownDark} />
            <Text style={styles.loadingText}>טוען…</Text>
          </View>
        ) : null}

        <RNWebView
          ref={webRef}
          source={{ uri: startUrl }}
          style={styles.webview}
          onLoadStart={() => {
            setLoading(true);
            setError(null);
            setProgress(0.08);
          }}
          onLoadProgress={({ nativeEvent }: any) => setProgress(nativeEvent.progress)}
          onLoadEnd={() => {
            setLoading(false);
            setProgress(1);
          }}
          onError={({ nativeEvent }: any) => {
            setLoading(false);
            setError(nativeEvent.description || "שגיאת רשת");
          }}
          onHttpError={({ nativeEvent }: any) => {
            if (nativeEvent.statusCode >= 500) {
              setError(`שגיאת שרת (${nativeEvent.statusCode})`);
            }
          }}
          onNavigationStateChange={onNavChange}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          onOpenWindow={(event: any) => {
            const url = event.nativeEvent.targetUrl;
            if (url && isTrustedWebViewUrl(url)) {
              webRef.current?.injectJavaScript(
                `window.location.href = ${JSON.stringify(url)}; true;`
              );
            } else if (url) {
              void openExternal(url);
            }
          }}
          onFileDownload={({ nativeEvent }: any) => {
            if (nativeEvent.downloadUrl) void openExternal(nativeEvent.downloadUrl);
          }}
          // Session / cookies
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          domStorageEnabled
          javaScriptEnabled
          cacheEnabled
          // File / media selection (Android uses system chooser)
          allowFileAccess
          allowFileAccessFromFileURLs={false}
          allowUniversalAccessFromFileURLs={false}
          mediaPlaybackRequiresUserAction={false}
          // UX
          setSupportMultipleWindows
          pullToRefreshEnabled={Platform.OS === "android"}
          startInLoadingState={false}
          allowsBackForwardNavigationGestures
          geolocationEnabled={false}
          // Mobile-friendly viewport hint for stubborn pages
          injectedJavaScriptBeforeContentLoaded={`
            (function() {
              try {
                var m = document.querySelector('meta[name="viewport"]');
                if (!m) {
                  m = document.createElement('meta');
                  m.setAttribute('name', 'viewport');
                  document.head && document.head.appendChild(m);
                }
                m.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover');
              } catch (e) {}
              true;
            })();
          `}
          userAgent={
            // Keep a modern Chrome mobile UA so Google OAuth and responsive CSS behave normally
            "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36 OfirBabyAdmin/1.0"
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 52,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "right",
    writingDirection: "rtl",
  },
  headerActions: { flexDirection: "row-reverse", gap: 8 },
  headerBtn: {
    minHeight: 40,
    minWidth: 64,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  headerBtnText: { color: colors.brownDark, fontWeight: "600", fontSize: 14 },
  progressTrack: { height: 3, backgroundColor: colors.border },
  progressBar: { height: 3, backgroundColor: colors.brownDark },
  progressSpacer: { height: 3 },
  webWrap: { flex: 1 },
  webview: { flex: 1, backgroundColor: colors.white },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(247,241,234,0.88)",
    gap: 10,
  },
  loadingText: { color: colors.muted, fontSize: 15 },
  errorBox: {
    margin: 16,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#F8E8E8",
    borderWidth: 1,
    borderColor: "#E2B4B4",
  },
  errorTitle: {
    color: colors.danger,
    fontWeight: "700",
    fontSize: 16,
    textAlign: "right",
    writingDirection: "rtl",
  },
  errorBody: {
    marginTop: 6,
    color: colors.ink,
    textAlign: "right",
    writingDirection: "rtl",
  },
  retryBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: colors.brownDark,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryText: { color: colors.white, fontWeight: "600" },
});
