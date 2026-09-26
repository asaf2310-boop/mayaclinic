import React from "react";
import { Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AppointmentsScreen from "../screens/AppointmentsScreen";
import AppointmentDetailScreen from "../screens/AppointmentDetailScreen";
import AvailabilityScreen from "../screens/AvailabilityScreen";
import TreatmentsScreen from "../screens/TreatmentsScreen";
import CustomersScreen from "../screens/CustomersScreen";
import GiftVouchersScreen from "../screens/GiftVouchersScreen";
import WebsiteAdminScreen from "../screens/WebsiteAdminScreen";
import MoreScreen from "../screens/MoreScreen";
import LoginScreen from "../screens/LoginScreen";
import { useAuth } from "../auth/AuthContext";
import { colors } from "../theme";
import { LoadingBlock } from "../components/ui";

const Tab = createBottomTabNavigator();
const AppointmentsStack = createNativeStackNavigator();
const MoreStack = createNativeStackNavigator();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 12, fontWeight: focused ? "700" : "500", color: focused ? colors.brownDark : colors.muted }}>
      {label}
    </Text>
  );
}

function AppointmentsStackScreen() {
  return (
    <AppointmentsStack.Navigator screenOptions={{ headerShown: false }}>
      <AppointmentsStack.Screen name="AppointmentsHome" component={AppointmentsScreen} />
      <AppointmentsStack.Screen name="AppointmentDetail" component={AppointmentDetailScreen} />
    </AppointmentsStack.Navigator>
  );
}

function MoreStackScreen() {
  return (
    <MoreStack.Navigator
      screenOptions={{
        headerTitleAlign: "center",
        headerBackTitle: "חזרה",
        headerTintColor: colors.brownDark,
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { color: colors.ink, fontWeight: "700" },
      }}
    >
      <MoreStack.Screen
        name="MoreHome"
        component={MoreScreen}
        options={{ title: "עוד", headerShown: false }}
      />
      <MoreStack.Screen name="Availability" component={AvailabilityScreen} options={{ title: "זמינות" }} />
      <MoreStack.Screen name="Treatments" component={TreatmentsScreen} options={{ title: "טיפולים" }} />
      <MoreStack.Screen name="Customers" component={CustomersScreen} options={{ title: "לקוחות" }} />
      <MoreStack.Screen name="GiftVouchers" component={GiftVouchersScreen} options={{ title: "שוברי מתנה" }} />
    </MoreStack.Navigator>
  );
}

function MainTabs() {
  return (
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
        tabBarLabelStyle: { fontSize: 13, fontWeight: "600" },
      }}
    >
      <Tab.Screen
        name="AppointmentsTab"
        component={AppointmentsStackScreen}
        options={{
          title: "תורים",
          tabBarIcon: ({ focused }) => <TabIcon label="📅" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="WebsiteTab"
        component={WebsiteAdminScreen}
        options={{
          title: "אתר",
          tabBarIcon: ({ focused }) => <TabIcon label="🌐" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="MoreTab"
        component={MoreStackScreen}
        options={{
          title: "עוד",
          tabBarIcon: ({ focused }) => <TabIcon label="☰" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingBlock />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainTabs /> : <LoginScreen />}
    </NavigationContainer>
  );
}
