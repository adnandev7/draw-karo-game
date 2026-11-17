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
};

export function GameBar({ round, total, seconds, isDrawer, myWord, mask, waiting }: Props) {
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
        <Text style={styles.round} numberOfLines={1}>
          {t.roundOf(round, total)}
        </Text>
      </View>

      {/* absolutely centered hint so the clock/round can never push it off */}
      <View style={styles.center}>
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

      {/* spacer mirrors the left side to keep the center honest */}
      <View style={[styles.side, styles.sideRight]} />
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
    borderRadius: R.m,
    borderWidth: 1,
    borderColor: C.panelBorder,
    height: 52,
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
  drawerWord: { color: C.gold },
  maskRow: {
    flexDirection: "row",
    gap: 3,
    flexWrap: "wrap",
    justifyContent: "center",
    paddingHorizontal: 120,
  },
  maskChar: {
    fontFamily: F.mono,
    fontSize: 19,
    lineHeight: 22,
  },
  maskHidden: { color: "#8fa8d8" },
  maskRevealed: { color: "#ffffff", fontWeight: "700" },
});
