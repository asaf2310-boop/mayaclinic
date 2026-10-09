import React, { useEffect } from "react";
import { I18nManager, StatusBar } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import RootNavigator from "./src/navigation/RootNavigator";
import { colors } from "./src/theme";

export default function App() {
  useEffect(() => {
    if (!I18nManager.isRTL) {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(true);
    }
  }, []);

  return (
    <SafeAreaProvider>
      {/* Bottom inset is handled inside the custom tab bar so labels stay above system nav. */}
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        <RootNavigator />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
