import "../global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "../session";
import { colors } from "../theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "none",
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ title: "Open Beds" }} />
          <Stack.Screen name="staff" options={{ title: "Shelter staff · Open Beds" }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
