/**
 * Web-only wrapper: CanvasKit (Skia's WASM runtime) must finish loading
 * BEFORE any module that imports @shopify/react-native-skia is evaluated.
 * Expo Router evaluates screen modules in app/ too early, so Skia
 * components are dynamically imported here after LoadSkiaWeb resolves.
 * (Documented pattern: react-native-skia "Web Support" → Expo.)
 */
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { WithSkiaWeb } from "@shopify/react-native-skia/lib/module/web";
import type { DrawCanvasProps } from "./DrawCanvas";
import { t } from "../../lib/strings";
import { skiaWebOpts } from "../../lib/skiaLoader";

export function DrawCanvasLazy(props: DrawCanvasProps) {
  return (
    <WithSkiaWeb
      getComponent={async () => {
        const mod = await import("./DrawCanvas");
        return { default: mod.DrawCanvas };
      }}
      opts={skiaWebOpts}
      componentProps={props}
      fallback={
        <View style={styles.fallback}>
          <ActivityIndicator color="#ffd700" size="large" />
          <Text style={styles.text}>{t.canvasLoading}</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    aspectRatio: 1,
    backgroundColor: "#ffffff",
    borderRadius: 16,
  },
  text: { color: "#0b2545", marginTop: 10, fontWeight: "700" },
});
