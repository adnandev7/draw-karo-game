/** Drawing toolbar — colors, brush sizes, eraser, undo, clear (drawer only). */
import { Pressable, StyleSheet, Text, View } from "react-native";

const COLORS = [
  "#111111",
  "#ffffff",
  "#e5484d",
  "#f4a300",
  "#ffd700",
  "#2c8ad8",
  "#1a9e4b",
  "#8e44ad",
  "#8d5524",
];
const SIZES = [0.006, 0.012, 0.024];

type Props = {
  color: string;
  width: number;
  tool: "brush" | "eraser";
  onChange: (v: { color?: string; width?: number; tool?: "brush" | "eraser" }) => void;
  onUndo: () => void;
  onClear: () => void;
};

export function Toolbar({ color, width, tool, onChange, onUndo, onClear }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.group}>
        {COLORS.map((c) => (
          <Pressable
            key={c}
            onPress={() => onChange({ color: c, tool: "brush" })}
            style={[styles.swatch, { backgroundColor: c }, color === c && tool === "brush" && styles.selected]}
          />
        ))}
      </View>
      <View style={styles.group}>
        {SIZES.map((s) => (
          <Pressable
            key={s}
            onPress={() => onChange({ width: s, tool: "brush" })}
            style={[styles.sizeDotWrap, width === s && tool === "brush" && styles.selected]}
          >
            <View
              style={{
                width: 6 + s * 500,
                height: 6 + s * 500,
                borderRadius: 99,
                backgroundColor: "#111111",
              }}
            />
          </Pressable>
        ))}
      </View>
      <View style={styles.group}>
        <Pressable
          onPress={() => onChange({ tool: tool === "eraser" ? "brush" : "eraser" })}
          style={[styles.action, tool === "eraser" && styles.selected]}
        >
          <Text style={styles.actionText}>🧽</Text>
        </Pressable>
        <Pressable onPress={onUndo} style={styles.action}>
          <Text style={styles.actionText}>↩️</Text>
        </Pressable>
        <Pressable onPress={onClear} style={styles.action}>
          <Text style={styles.actionText}>🗑️</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  group: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ffffff20",
    borderRadius: 12,
    padding: 6,
  },
  swatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#ffffff40",
  },
  sizeDotWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  action: {
    width: 34,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { fontSize: 16 },
  selected: {
    borderColor: "#ffd700",
    borderWidth: 2,
  },
});
