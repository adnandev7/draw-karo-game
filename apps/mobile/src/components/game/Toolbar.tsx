/**
 * Toolbar — skribbl-style drawing controls (drawer only):
 * two-row color strip, brush size popup, pen / eraser / undo / clear.
 */
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { C, DRAW_COLORS, DRAW_SIZES, flatShadow } from "../../lib/theme";

type Tool = "brush" | "eraser";

type Props = {
  color: string;
  width: number;
  tool: Tool;
  onChange: (v: { color?: string; width?: number; tool?: Tool }) => void;
  onUndo: () => void;
  onClear: () => void;
};

export function Toolbar({ color, width, tool, onChange, onUndo, onClear }: Props) {
  const [sizesOpen, setSizesOpen] = useState(false);

  return (
    <View style={[styles.wrap, flatShadow]}>
      {/* color strip: 2 rows of 12 */}
      <View style={styles.colors}>
        {[0, 1].map((row) => (
          <View key={row} style={styles.colorRow}>
            {DRAW_COLORS.slice(row * 12, row * 12 + 12).map((c) => (
              <Pressable
                key={c}
                onPress={() => onChange({ color: c, tool: "brush" })}
                style={[
                  styles.color,
                  { backgroundColor: c },
                  color === c && tool === "brush" && styles.colorSelected,
                ]}
              />
            ))}
          </View>
        ))}
      </View>

      {/* size picker */}
      <View style={styles.sizes}>
        {sizesOpen ? (
          <View style={styles.sizePopup}>
            {DRAW_SIZES.map((s) => (
              <Pressable
                key={s}
                onPress={() => {
                  onChange({ width: s, tool: "brush" });
                  setSizesOpen(false);
                }}
                style={[styles.sizeCell, width === s && tool === "brush" && styles.cellSelected]}
              >
                <View
                  style={{
                    width: 4 + s * 340,
                    height: 4 + s * 340,
                    borderRadius: 99,
                    backgroundColor: "#111111",
                  }}
                />
              </Pressable>
            ))}
          </View>
        ) : null}
        <Pressable style={styles.sizeBtn} onPress={() => setSizesOpen((v) => !v)}>
          <View
            style={{
              width: 6 + width * 340,
              height: 6 + width * 340,
              borderRadius: 99,
              backgroundColor: "#111111",
            }}
          />
        </Pressable>
      </View>

      {/* tools */}
      <View style={styles.tools}>
        <ToolButton
          label="✏️"
          selected={tool === "brush"}
          onPress={() => onChange({ tool: "brush" })}
        />
        <ToolButton
          label="🧽"
          selected={tool === "eraser"}
          onPress={() => onChange({ tool: "eraser" })}
        />
        <ToolButton label="↩️" onPress={onUndo} />
        <ToolButton label="🗑️" onPress={onClear} />
      </View>
    </View>
  );
}

function ToolButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.tool, selected && styles.toolSelected]} onPress={onPress}>
      <Text style={styles.toolText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 6,
    padding: 5,
    gap: 8,
    alignSelf: "stretch",
  },
  colors: { gap: 1 },
  colorRow: { flexDirection: "row", gap: 2 },
  color: {
    width: 22,
    height: 14,
    borderRadius: 3,
  },
  colorSelected: {
    borderWidth: 2,
    borderColor: C.toolActive,
  },
  sizes: { position: "relative" },
  sizeBtn: {
    width: 34,
    height: 34,
    borderRadius: 5,
    backgroundColor: "#ececec",
    alignItems: "center",
    justifyContent: "center",
  },
  sizePopup: {
    position: "absolute",
    bottom: 40,
    left: 0,
    backgroundColor: "#ffffff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.panelBorder,
    padding: 4,
    gap: 2,
    zIndex: 30,
    ...flatShadow,
  },
  sizeCell: {
    width: 36,
    height: 26,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  cellSelected: { backgroundColor: C.toolActive },
  tools: { flexDirection: "row", gap: 4, marginLeft: "auto" },
  tool: {
    width: 36,
    height: 34,
    borderRadius: 5,
    backgroundColor: "#ececec",
    alignItems: "center",
    justifyContent: "center",
  },
  toolSelected: { backgroundColor: C.toolActive },
  toolText: { fontSize: 16 },
});
