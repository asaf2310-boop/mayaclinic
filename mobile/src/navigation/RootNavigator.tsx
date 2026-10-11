import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AdminWebView from "../components/AdminWebView";
import { APPOINTMENTS_ADMIN_URL, WEBSITE_ADMIN_URL } from "../config";
import { colors } from "../theme";

type TabKey = "appointments" | "website";

const TABS: { key: TabKey; label: string }[] = [
  { key: "appointments", label: "תורים" },
  { key: "website", label: "אתר" },
];

export default function RootNavigator() {
  const [active, setActive] = useState<TabKey>("appointments");
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        {/* Keep both WebViews mounted so each tab retains its own session.
            Inactive pane stays laid out (not display:none) so Android WebView keeps a real size. */}
        <View
          style={active === "appointments" ? styles.paneVisible : styles.paneHidden}
          pointerEvents={active === "appointments" ? "auto" : "none"}
          collapsable={false}
        >
          <AdminWebView
            startUrl={APPOINTMENTS_ADMIN_URL}
            title="תורים"
            isActive={active === "appointments"}
          />
        </View>
        <View
          style={active === "website" ? styles.paneVisible : styles.paneHidden}
          pointerEvents={active === "website" ? "auto" : "none"}
          collapsable={false}
        >
          <AdminWebView
            startUrl={WEBSITE_ADMIN_URL}
            title="אתר"
            isActive={active === "website"}
          />
        </View>
      </View>

      <View
        style={[
          styles.tabBar,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
        accessibilityRole="tablist"
      >
        <Text style={styles.tabBarHint}>בחרי מסך</Text>
        <View style={styles.tabRow}>
          {TABS.map((tab) => {
            const selected = active === tab.key;
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={tab.label}
                onPress={() => setActive(tab.key)}
                style={[styles.tabBtn, selected && styles.tabBtnActive]}
              >
                <Text
                  style={[styles.tabLabel, selected && styles.tabLabelActive]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, overflow: "hidden" },
  paneVisible: {
    flex: 1,
  },
  paneHidden: {
    // Keep off-screen but with non-zero layout so the WebView can finish loading.
    position: "absolute",
    width: "100%",
    height: "100%",
    left: -10000,
    top: 0,
    opacity: 0,
  },
  tabBar: {
    backgroundColor: colors.brownDark,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: "#2A1F18",
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    zIndex: 10,
  },
  tabBarHint: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
    writingDirection: "rtl",
  },
  tabRow: {
    // With app-wide RTL, row places the first tab (תורים) on the right.
    flexDirection: "row",
    gap: 10,
  },
  tabBtn: {
    flex: 1,
    minHeight: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },
  tabBtnActive: {
    backgroundColor: colors.white,
    borderColor: colors.white,
  },
  tabLabel: {
    fontSize: 22,
    fontWeight: "800",
    color: "rgba(255,255,255,0.92)",
    writingDirection: "rtl",
  },
  tabLabelActive: {
    color: colors.brownDark,
  },
});
