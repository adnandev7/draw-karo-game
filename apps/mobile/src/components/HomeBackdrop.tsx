/**
 * HomeBackdrop — skribbl-style playful world:
 * a tiled hand-drawn doodle pattern (web) / floating doodles (native)
 * over the deep blue, plus two animated wave bands sliding at the bottom.
 */
import { useEffect, useMemo } from "react";
import { Platform, StyleSheet, View, Image, Animated, Easing } from "react-native";

// Hand-drawn doodle tile: stars, smileys, hearts, rockets, pizza, notes…
// Stroke-only white shapes at low opacity — our own artwork, not skribbl's.
function doodleTileSvg(): string {
  const s = "stroke='#ffffff' stroke-opacity='0.13' stroke-width='3' fill='none' stroke-linecap='round' stroke-linejoin='round'";
  const shapes = [
    "<path d='M40 40 l6 14 15 1 -11 10 3 15 -13 -8 -13 8 3 -15 -11 -10 15 -1 z'/>",
    "<circle cx='120' cy='60' r='20'/>",
    "<circle cx='113' cy='55' r='2.5' fill='#fff'/>",
    "<circle cx='127' cy='55' r='2.5' fill='#fff'/>",
    "<path d='M111 65 q9 9 18 0'/>",
    "<path d='M210 30 c-8 -10 -24 -2 -18 10 c4 9 18 14 18 14 c0 0 14 -5 18 -14 c6 -12 -10 -20 -18 -10 z'/>",
    "<circle cx='290' cy='55' r='18'/>",
    "<path d='M283 52 l14 0 M290 45 l0 14'/>",
    "<path d='M60 140 q14 -22 28 0 q-14 14 -28 0 z'/>",
    "<path d='M150 150 l0 -28 m-8 10 l8 -10 l8 10'/>",
    "<path d='M240 150 c0 -12 8 -20 18 -20 c10 0 18 8 18 20 c0 14 -8 24 -18 30 c-10 -6 -18 -16 -18 -30 z M240 150 l36 0 M252 136 l0 14 M264 136 l0 14'/>",
    "<path d='M40 250 c10 -14 30 -14 40 0 z M46 244 l-4 -8 M56 240 l0 -10 M66 244 l4 -8'/>",
    "<circle cx='170' cy='240' r='14'/>",
    "<path d='M166 236 l8 8 M174 236 l-8 8'/>",
    "<path d='M280 230 l10 22 -10 -4 -10 4 z'/>",
    "<path d='M90 320 q16 -20 32 0 q-16 16 -32 0 z'/>",
    "<path d='M200 310 l14 0 0 20 -14 0 z M214 315 l12 -4 0 12 -12 4'/>",
    "<circle cx='320' cy='320' r='12'/>",
    "<path d='M316 316 l8 8 M324 316 l-8 8'/>",
  ].join("");
  return (
    "<svg xmlns='http://www.w3.org/2000/svg' width='360' height='360' viewBox='0 0 360 360'>" +
    "<g " + s + ">" + shapes + "</g>" +
    "</svg>"
  );
}

// NOTE: RN Web's resolveAssetUri re-encodes the payload of
// `data:image/svg+xml;utf8,` URIs itself — so pass the RAW svg here,
// never pre-encoded with encodeURIComponent (that double-encodes and
// makes the image fail to load).
const DOODLE_URI = "data:image/svg+xml;utf8," + doodleTileSvg();

const WAVE_URI =
  "data:image/svg+xml;utf8," +
  `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='120' viewBox='0 0 1200 120'>` +
  `<path d='M0 60 Q 150 0 300 60 T 600 60 T 900 60 T 1200 60 V 120 H 0 Z' fill='#1668d6' fill-opacity='0.85'/>` +
  `</svg>`;

export function HomeBackdrop() {
  const wave1 = useDrift(26000);
  const wave2 = useDrift(38000, true);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* doodle pattern */}
      {Platform.OS === "web" ? (
        <Image
          source={{ uri: DOODLE_URI }}
          style={StyleSheet.absoluteFill}
          resizeMode="repeat"
        />
      ) : (
        <FloatingDoodles />
      )}
      {/* waves pinned to the bottom (home screen only) */}
      <View style={styles.waveSlot}>
        <Animated.Image
          source={{ uri: WAVE_URI }}
          style={[styles.wave, { transform: [{ translateX: wave1 }] }]}
          resizeMode="repeat"
        />
        <Animated.Image
          source={{ uri: WAVE_URI }}
          style={[styles.wave, styles.waveLow, { transform: [{ translateX: wave2 }] }]}
          resizeMode="repeat"
        />
      </View>
    </View>
  );
}

/** Game-screen backdrop: doodle pattern only, no waves. */
export function GameBackdrop() {
  if (Platform.OS !== "web") return <FloatingDoodles />;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image source={{ uri: DOODLE_URI }} style={StyleSheet.absoluteFill} resizeMode="repeat" />
    </View>
  );
}

function useDrift(duration: number, reverse = false) {
  const val = useMemo(() => new Animated.Value(reverse ? -600 : 0), [reverse]);
  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(val, {
        toValue: reverse ? 0 : -600,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [duration, reverse, val]);
  return val;
}

/** Native fallback: a few floating doodle emoji. */
function FloatingDoodles() {
  const items: { e: string; top: string; left: string; s: number; d: number }[] = [
    { e: "⭐", top: "8%", left: "10%", s: 22, d: 0 },
    { e: "😄", top: "18%", left: "78%", s: 26, d: 400 },
    { e: "🎨", top: "42%", left: "6%", s: 24, d: 800 },
    { e: "🚀", top: "55%", left: "85%", s: 22, d: 1200 },
    { e: "🍕", top: "70%", left: "14%", s: 24, d: 1600 },
    { e: "🎵", top: "30%", left: "45%", s: 20, d: 2000 },
  ];
  return (
    <View style={StyleSheet.absoluteFill}>
      {items.map((it) => (
        <FloatItem key={it.e} {...it} />
      ))}
    </View>
  );
}

function FloatItem({ e, top, left, s, d }: { e: string; top: string; left: string; s: number; d: number }) {
  const val = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(val, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(val, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [val]);
  return (
    <Animated.Text
      style={{
        position: "absolute",
        top,
        left,
        fontSize: s,
        opacity: 0.16,
        transform: [{ translateY: val.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) }],
      }}
    >
      {e}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  waveSlot: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 110,
    overflow: "hidden",
  },
  wave: {
    position: "absolute",
    bottom: 0,
    left: -600,
    width: 2400,
    height: 90,
  },
  waveLow: {
    bottom: -14,
    height: 76,
    opacity: 0.7,
  },
});
