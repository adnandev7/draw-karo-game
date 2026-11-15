import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { Stack, DefaultTheme, ThemeProvider } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  useFonts,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from "@expo-google-fonts/nunito";
import { preloadSkiaWeb } from "../lib/skiaLoader";

/**
 * Root layout. On web, Skia's WASM engine (CanvasKit) must be loaded before
 * any route module that uses it is evaluated — so we preload it at boot and
 * hold the Stack until it's ready. Nunito (our UI font) loads in the same
 * gate. On native both resolve quickly.
 */
export default function RootLayout() {
  const [skiaReady, setSkiaReady] = useState(Platform.OS !== "web");
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  useEffect(() => {
    if (skiaReady) return;
    preloadSkiaWeb()
      .catch((e) => console.warn("Skia web preload failed:", e))
      .finally(() => setSkiaReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ready = skiaReady && fontsLoaded;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={DefaultTheme}>
        {ready ? (
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="room" />
          </Stack>
        ) : (
          <View style={styles.splash}>
            <ActivityIndicator size="large" color="#53e237" />
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
    backgroundColor: "#124da5",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  splashText: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
    fontFamily: "Nunito_900Black",
  },
});
