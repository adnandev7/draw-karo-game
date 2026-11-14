import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View, useColorScheme } from "react-native";
import { Stack, DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { preloadSkiaWeb } from "../lib/skiaLoader";

/**
 * Root layout. On web, Skia's WASM engine (CanvasKit) must be loaded before
 * any route module that uses it is evaluated — so we preload it at boot and
 * hold the Stack until it's ready. On native this resolves instantly.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [ready, setReady] = useState(Platform.OS !== "web");

  useEffect(() => {
    if (ready) return;
    preloadSkiaWeb()
      .catch((e) => console.warn("Skia web preload failed:", e))
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        {ready ? (
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="room" />
          </Stack>
        ) : (
          <View style={styles.splash}>
            <ActivityIndicator size="large" color="#ffd700" />
            <Text style={styles.splashText}>Draw Karo</Text>
          </View>
        )}
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: "#208AEF",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  splashText: { color: "#ffffff", fontSize: 24, fontWeight: "900" },
});
