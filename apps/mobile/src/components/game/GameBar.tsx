/**
 * GameBar — skribbl-style status bar: clock, round counter and the
 * monospace hint mask truly centered (absolute center, not flexed),
 * with a pulsing clock when time is running out.
 */
import { useEffect, useMemo } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { t } from "../../lib/strings";
import { C, F, R } from "../../lib/theme";

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
  /** Phone-width layout: the hint shares the row instead of floating over it. */
  narrow?: boolean;
};

export function GameBar({ round, total, seconds, isDrawer, myWord, mask, waiting, narrow }: Props) {
  const urgent = seconds <= 10 && !waiting;
  const pulse = usePulse(urgent);

  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        <View style={[styles.clock, urgent && styles.clockUrgent, { transform: [{ scale: pulse }] }]}>
          <Text style={styles.clockText}>
            {waiting && seconds <= 0 ? "·" : Math.max(0, seconds)}
          </Text>
        </View>
        <Text style={[styles.round, narrow && styles.roundNarrow]} numberOfLines={1}>
          {narrow ? t.roundLabel(round, total) : t.roundOf(round, total)}
        </Text>
      </View>

      {/* absolutely centered hint over the whole bar in both layouts — the
          mask wraps and has no side padding, so it can never spill out */}
      <View style={styles.center}>
        {waiting ? (
          <Text style={styles.hintLabel}>{isDrawer ? t.yourTurnNext : t.waitingNext}</Text>
        ) : isDrawer && myWord ? (
          <>
            <Text style={styles.hintLabel}>{t.drawThis}</Text>
            <Text style={[styles.word, styles.drawerWord, narrow && styles.wordNarrow]} numberOfLines={1}>
              {myWord}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.hintLabel}>{t.guessThis}</Text>
            <Mask text={mask} narrow={narrow} />
          </>
        )}
      </View>

      {/* spacer mirrors the left side to keep the wide center honest */}
      {narrow ? null : <View style={[styles.side, styles.sideRight]} />}
    </View>
  );
}

function usePulse(active: boolean) {
  const val = useMemo(() => new Animated.Value(1), []);
  useEffect(() => {
    if (!active) {
      val.setValue(1);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(val, { toValue: 1.18, duration: 380, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(val, { toValue: 1, duration: 380, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [active, val]);
  return val;
}

function Mask({ text, narrow }: { text: string; narrow?: boolean }) {
  return (
    <View style={[styles.maskRow, narrow && styles.maskRowNarrow]}>
      {text
        .split("")
        .filter((ch) => ch.trim())
        .map((ch, i) => (
          <Text
            key={i}
            style={[styles.maskChar, narrow && styles.maskCharNarrow, ch === "_" ? styles.maskHidden : styles.maskRevealed]}
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
    borderRadius: R.m,
    borderWidth: 1,
    borderColor: C.panelBorder,
    minHeight: 52,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  side: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 2,
  },
  sideRight: { flex: 1 },
  clock: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
    maxWidth: 110,
  },
  roundNarrow: { maxWidth: 74, fontSize: 11 },
  center: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    zIndex: 1,
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
  wordNarrow: { fontSize: 15 },
  drawerWord: { color: C.gold },
  maskRow: {
    flexDirection: "row",
    gap: 3,
    flexWrap: "wrap",
    justifyContent: "center",
    paddingHorizontal: 120,
  },
  maskRowNarrow: { paddingHorizontal: 0 },
  maskChar: {
    fontFamily: F.mono,
    fontSize: 19,
    lineHeight: 22,
  },
  maskCharNarrow: { fontSize: 14, lineHeight: 17 },
  maskHidden: { color: "#8fa8d8" },
  maskRevealed: { color: "#ffffff", fontWeight: "700" },
});
