/**
 * Draw Karo — Home screen (M0 skeleton).
 * Placeholder identity + a Skia canvas smoke test proving the native
 * drawing engine loads. Real Home flow (name + avatar + rooms) lands in M1.
 */
import { StyleSheet, Text, View } from "react-native";
import { Canvas, Circle, Fill, RoundedRect } from "@shopify/react-native-skia";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Draw Karo!</Text>
        <Text style={styles.tagline}>Banao. Pehchano. Haso. 🎨</Text>
      </View>

      {/* M0 smoke test: if this paints, the native Skia engine works */}
      <View style={styles.canvasWrap}>
        <Canvas style={styles.canvas}>
          <Fill color="#fdf6e3" />
          <RoundedRect x={20} y={20} width={280} height={180} r={16} color="#ffffff" />
          <Circle cx={80} cy={110} r={34} color="#f4a300" />
          <Circle cx={160} cy={90} r={26} color="#e5484d" />
          <Circle cx={230} cy={120} r={30} color="#2c8ad8" />
        </Canvas>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>M0 skeleton running 🛠️</Text>
        <Text style={styles.footerSub}>Play Now & Join Room arrive in M1</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#208AEF",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 80,
    paddingBottom: 48,
  },
  header: { alignItems: "center", gap: 8 },
  title: {
    fontSize: 44,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 16,
    color: "#dbeeff",
    fontWeight: "600",
  },
  canvasWrap: {
    borderRadius: 20,
    overflow: "hidden",
  },
  canvas: { width: 320, height: 220 },
  footer: { alignItems: "center", gap: 4 },
  footerText: { color: "#ffffff", fontWeight: "700", fontSize: 15 },
  footerSub: { color: "#9fc9f5", fontSize: 13 },
});
