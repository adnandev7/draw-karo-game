/**
 * Logo — funky multicolor cartoon wordmark: each letter bounces with a
 * staggered delay (like skribbl's playful logo), chunky dark shadow,
 * wiggling pencil at the end.
 */
import { useEffect, useMemo } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { LOGO_COLORS, F } from "../lib/theme";

type Props = {
  /** Font size of the wordmark. */
  size?: number;
};

export function Logo({ size = 52 }: Props) {
  const letters = "Draw Karo!".split("");
  const pencil = useWiggle();

  return (
    <View style={styles.row} pointerEvents="none">
      {letters.map((ch, i) =>
        ch === " " ? (
          <View key={i} style={{ width: size * 0.32 }} />
        ) : (
          <BouncyLetter key={i} ch={ch} i={i} size={size} />
        )
      )}
      <Animated.Text style={[styles.pencil, { fontSize: size * 0.55, transform: [{ rotate: pencil }] }]}>
        ✏️
      </Animated.Text>
    </View>
  );
}

function BouncyLetter({ ch, i, size }: { ch: string; i: number; size: number }) {
  const y = useLetterBounce(i);
  return (
    <Animated.Text
      style={[
        styles.letter,
        {
          fontSize: size,
          lineHeight: size * 1.15,
          color: LOGO_COLORS[i % LOGO_COLORS.length],
          transform: [{ translateY: y }, { rotate: i % 2 ? "2deg" : "-2deg" }],
        },
      ]}
    >
      {ch}
    </Animated.Text>
  );
}

function useLetterBounce(i: number) {
  const val = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(val, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true, delay: i * 130 }),
        Animated.timing(val, { toValue: 0, duration: 700, easing: Easing.bounce, useNativeDriver: true }),
        Animated.timing(val, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [i, val]);
  return val.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
}

function useWiggle() {
  const val = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(val, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(val, { toValue: -1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(val, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [val]);
  return val.interpolate({ inputRange: [-1, 1], outputRange: ["-24deg", "-4deg"] });
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  letter: {
    fontFamily: F.black,
    textShadowColor: "rgba(4, 18, 48, 0.55)",
    textShadowOffset: { width: 3, height: 4 },
    textShadowRadius: 0,
  },
  pencil: {
    marginLeft: 4,
    marginBottom: 6,
  },
});
