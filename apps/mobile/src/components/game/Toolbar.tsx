/**
 * Toolbar — skribbl's bottom drawer toolbar (drawer only):
 * big current-color block, 2×12 color grid, size picker with popup,
 * and tool buttons with letter captions (B / U / C) under the icons —
 * the layout the skribbl screenshot made famous.
 */
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { C, DRAW_COLORS, DRAW_SIZES, F, R, shade } from "../../lib/theme";

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
    <View style={styles.wrap}>
      {/* big current-color block (skribbl's "what am I holding" swatch) */}
      <View style={[styles.current, { backgroundColor: tool === "eraser" ? "#ffffff" : color }]}>
        <Text style={styles.currentIcon}>{tool === "eraser" ? "🧽" : "✏️"}</Text>
      </View>

      {/* color grid: 2 rows of 12 */}
      <View style={styles.colors}>
        {[0, 1].map((row) => (
          <View key={row} style={styles.colorRow}>
            {DRAW_COLORS.slice(row * 12, row * 12 + 12).map((c) => {
              const selected = color === c && tool === "brush";
              return (
                <Pressable
                  key={c}
                  onPress={() => onChange({ color: c, tool: "brush" })}
                  style={[
                    styles.color,
                    { backgroundColor: c },
                    selected && styles.colorSelected,
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>

      {/* size picker with popup */}
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

      {/* tools with letter captions — B pencil · eraser · U undo · C clear */}
      <View style={styles.tools}>
        <ToolButton
          icon="✏️"
          caption="B"
          selected={tool === "brush"}
          onPress={() => onChange({ tool: "brush" })}
        />
        <ToolButton
          icon="🧽"
          caption=""
          selected={tool === "eraser"}
          onPress={() => onChange({ tool: "eraser" })}
        />
        <ToolButton icon="↩️" caption="U" onPress={onUndo} />
        <ToolButton icon="🗑️" caption="C" onPress={onClear} />
      </View>
    </View>
  );
}

function ToolButton({
  icon,
  caption,
  selected,
  onPress,
}: {
  icon: string;
  caption: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.tool, selected && styles.toolSelected]} onPress={onPress}>
      <Text style={styles.toolIcon}>{icon}</Text>
      <Text style={styles.toolCaption}>{caption}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    backgroundColor: "#ffffff",
    borderRadius: R.m,
    padding: 6,
    gap: 6,
    alignSelf: "stretch",
  },
  current: {
    width: 40,
    height: 40,
    borderRadius: R.s,
    borderWidth: 2,
    borderColor: "#2b2b2b",
    alignItems: "center",
    justifyContent: "center",
  },
  currentIcon: { fontSize: 18 },
  colors: { gap: 2 },
  colorRow: { flexDirection: "row", gap: 2 },
  color: {
    width: 20,
    height: 16,
    borderRadius: 4,
  },
  colorSelected: {
    borderWidth: 2,
    borderColor: "#2b2b2b",
  },
  sizes: { position: "relative" },
  sizeBtn: {
    width: 36,
    height: 40,
    borderRadius: R.s,
    backgroundColor: "#ececec",
    alignItems: "center",
    justifyContent: "center",
  },
  sizePopup: {
    position: "absolute",
    bottom: 44,
    left: 0,
    backgroundColor: "#ffffff",
    borderRadius: R.m,
    borderWidth: 2,
    borderColor: C.panelBorder,
    padding: 4,
    gap: 2,
    zIndex: 30,
  },
  sizeCell: {
    width: 36,
    height: 28,
    borderRadius: R.s,
    alignItems: "center",
    justifyContent: "center",
  },
  cellSelected: { backgroundColor: C.toolActive },
  tools: { flexDirection: "row", gap: 4, marginLeft: "auto" },
  tool: {
    width: 38,
    height: 40,
    borderRadius: R.s,
    backgroundColor: "#ececec",
    alignItems: "center",
    justifyContent: "center",
  },
  toolSelected: { backgroundColor: shade(C.toolActive, 0.25) },
  toolIcon: { fontSize: 15, lineHeight: 18 },
  toolCaption: {
    fontSize: 9,
    fontFamily: F.black,
    color: "#444444",
    lineHeight: 11,
  },
});
