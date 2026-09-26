import React, { useState } from "react";
import { Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import AdminWebView from "../components/AdminWebView";
import { APPOINTMENTS_ADMIN_URL, WEBSITE_ADMIN_URL } from "../config";
import { colors } from "../theme";

const Tab = createBottomTabNavigator();

function AppointmentsTab({ isFocused }: { isFocused: boolean }) {
  return (
    <AdminWebView
      startUrl={APPOINTMENTS_ADMIN_URL}
      title="תורים"
      isActive={isFocused}
    />
  );
}

function WebsiteTab({ isFocused }: { isFocused: boolean }) {
  return (
    <AdminWebView
      startUrl={WEBSITE_ADMIN_URL}
      title="אתר"
      isActive={isFocused}
    />
  );
}

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      style={{
        fontSize: 16,
        opacity: focused ? 1 : 0.55,
      }}
    >
      {label}
    </Text>
  );
}

export default function RootNavigator() {
  const [active, setActive] = useState<"Appointments" | "Website">("Appointments");

  return (
    <NavigationContainer
      onStateChange={(state) => {
        const route = state?.routes?.[state.index || 0];
        if (route?.name === "Appointments" || route?.name === "Website") {
          setActive(route.name);
        }
      }}
    >
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.brownDark,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            height: 64,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 13,
            fontWeight: "700",
          },
        }}
      >
        <Tab.Screen
          name="Appointments"
          options={{
            title: "תורים",
            tabBarIcon: ({ focused }) => <TabIcon label="📅" focused={focused} />,
          }}
        >
          {() => <AppointmentsTab isFocused={active === "Appointments"} />}
        </Tab.Screen>
        <Tab.Screen
          name="Website"
          options={{
            title: "אתר",
            tabBarIcon: ({ focused }) => <TabIcon label="🌐" focused={focused} />,
          }}
        >
          {() => <WebsiteTab isFocused={active === "Website"} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
