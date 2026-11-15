/**
 * GameBar — skribbl-style status bar: clock, round counter and the
 * monospace hint mask (or the drawer's secret word) centered.
 */
import { StyleSheet, Text, View } from "react-native";
import { t } from "../../lib/strings";
import { C, F, flatShadow } from "../../lib/theme";

type Props = {
  round: number;
  total: number;
  seconds: number;
  isDrawer: boolean;
  /** Full word (drawer only). */
  myWord: string | null;
  /** Underscore mask shown to guessers. */
  mask: string;
  waiting?: boolean;
};

export function GameBar({ round, total, seconds, isDrawer, myWord, mask, waiting }: Props) {
  const urgent = seconds <= 10 && !waiting;

  return (
    <View style={[styles.bar, flatShadow]}>
      <View style={[styles.clock, urgent && styles.clockUrgent]}>
        <Text style={styles.clockText}>{waiting ? "·" : Math.max(0, seconds)}</Text>
      </View>
      <Text style={styles.round} numberOfLines={1}>
        {t.roundOf(round, total)}
      </Text>
      <View style={styles.wordWrap}>
        {waiting ? (
          <Text style={styles.hintLabel}>{isDrawer ? t.yourTurnNext : t.waitingNext}</Text>
        ) : isDrawer && myWord ? (
          <>
            <Text style={styles.hintLabel}>{t.drawThis}</Text>
            <Text style={[styles.word, styles.drawerWord]}>{myWord}</Text>
          </>
        ) : (
          <>
            <Text style={styles.hintLabel}>{t.guessThis}</Text>
            <Mask text={mask} />
          </>
        )}
      </View>
      <View style={styles.roundSpacer} />
    </View>
  );
}

function Mask({ text }: { text: string }) {
  return (
    <View style={styles.maskRow}>
      {text
        .split("")
        .filter((ch) => ch.trim())
        .map((ch, i) => (
          <Text
            key={i}
            style={[styles.maskChar, ch === "_" ? styles.maskHidden : styles.maskRevealed]}
          >
            {ch}
          </Text>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.panel,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.panelBorder,
    height: 48,
    paddingHorizontal: 6,
    gap: 8,
  },
  clock: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  clockUrgent: { backgroundColor: "#ffd2d2" },
  clockText: {
    fontFamily: F.black,
    fontSize: 17,
    color: "#111111",
  },
  round: {
    color: "#ffffff",
    fontFamily: F.bold,
    fontSize: 12,
    opacity: 0.95,
  },
  roundSpacer: { width: 40 },
  wordWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  hintLabel: {
    color: "rgba(255,255,255,0.75)",
    fontFamily: F.bold,
    fontSize: 10,
    letterSpacing: 1,
  },
  word: {
    color: "#ffffff",
    fontFamily: F.xbold,
    fontSize: 18,
  },
  drawerWord: { color: C.gold },
  maskRow: {
    flexDirection: "row",
    gap: 3,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  maskChar: {
    fontFamily: F.mono,
    fontSize: 19,
    lineHeight: 22,
  },
  maskHidden: { color: "#8fa8d8" },
  maskRevealed: { color: "#ffffff", fontWeight: "700" },
});
