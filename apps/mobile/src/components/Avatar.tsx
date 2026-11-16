/**
 * Avatar v4 — skribbl's avatar philosophy:
 * ONE flat color for the whole little doodle (head + body share it),
 * chunky dark outline, a minimal funny face, nothing else — no hair,
 * no outfit, no accessories. Cute comes from the eyes + mouth combos.
 *
 * Motion — lifted straight from skribbl's stylesheet (fast + minimal):
 * - NO idle loop; the doodle stands perfectly still.
 * - `avatar_bounce`: cycling eyes/mouth dips that layer 6% down for 125ms.
 * - `avatar_clicked`: the whole avatar pops to 1.2 scale for 125ms.
 */
import { useEffect, useMemo } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import type { AvatarDescriptor } from "@drawkaro/shared";

// ─── Catalogs ─────────────────────────────────────────────────────────────────

/** Eyes + brows (baked together, like skribbl's first arrow row). */
export const EXPRESSION_IDS = [
  "happy", "dots", "surprised", "wink", "squint", "glasses", "sleepy", "angry", "love",
] as const;

/** Mouths (skribbl's second arrow row). */
export const MOUTH_IDS = [
  "smile", "grin", "squiggle", "open", "flat", "frown", "tongue",
] as const;

/** Blob colors (skribbl's third arrow row) — brights plus warm skin tones. */
export const BLOB_COLORS = [
  "#f25c54", "#ff9f43", "#ffd93d", "#6ee76e", "#3dd6c8",
  "#4cc9f0", "#a78bfa", "#ff8fab", "#c68642", "#ffdbac",
] as const;

const INK = "#26211d";

type Props = {
  avatar: AvatarDescriptor;
  size: number;
  /** Increment to play the 125ms whole-avatar pop (skribbl's avatar_clicked). */
  pop?: number;
  /** Increment to bounce the eyes layer 6% down for 125ms (skribbl's avatar_bounce). */
  eyesBounce?: number;
  /** Increment to bounce the mouth layer 6% down for 125ms. */
  mouthBounce?: number;
};

export function Avatar({ avatar, size, pop = 0, eyesBounce = 0, mouthBounce = 0 }: Props) {
  const color = avatar.skinTone;
  const outline = Math.max(2, size * 0.05);
  const whole = usePulse(pop, (v) => [
    { transform: [{ scale: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [1, 1.2, 1] }) }] },
  ]);
  const eyes = usePulse(eyesBounce, (v) => [
    { transform: [{ translateY: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, size * 0.06, 0] }) }] },
  ]);
  const mouth = usePulse(mouthBounce, (v) => [
    { transform: [{ translateY: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, size * 0.06, 0] }) }] },
  ]);

  return (
    <Animated.View style={[styles.wrap, { width: size, height: size }, whole]}>
      {/* body blob — tucked right under the head so the doodle reads as one character */}
      <View
        style={[
          styles.body,
          {
            width: size * 0.58,
            height: size * 0.32,
            backgroundColor: color,
            borderColor: INK,
            borderWidth: outline,
            borderTopLeftRadius: size * 0.2,
            borderTopRightRadius: size * 0.2,
            borderBottomLeftRadius: size * 0.12,
            borderBottomRightRadius: size * 0.12,
          },
        ]}
      />
      {/* head */}
      <View
        style={[
          styles.head,
          {
            width: size * 0.56,
            height: size * 0.56,
            borderRadius: size * 0.28,
            backgroundColor: color,
            borderColor: INK,
            borderWidth: outline,
            top: size * 0.12,
          },
        ]}
      >
        <Animated.View style={[StyleSheet.absoluteFill, eyes]}>
          <Eyes id={avatar.expression} size={size} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, mouth]}>
          <Mouth id={avatar.mouth ?? "smile"} size={size} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

// ─── Motion ───────────────────────────────────────────────────────────────────

/**
 * One-shot 125ms pulse, re-fired whenever `signal` increments — skribbl's
 * avatar_bounce / avatar_clicked timings (0% → 15% peak → back).
 */
function usePulse(
  signal: number,
  makeStyle: (v: Animated.Value) => object,
): object {
  const val = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    if (signal === 0) return;
    val.setValue(0);
    Animated.timing(val, {
      toValue: 1,
      duration: 125,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [signal, val]);
  return makeStyle(val);
}

// ─── Eyes ─────────────────────────────────────────────────────────────────────

/** Face geometry is sized off the head width so every feature stays inside the blob. */
function Eyes({ id, size }: { id: string; size: number }) {
  const dark = INK;
  const hw = size * 0.56; // head width/height
  const dot = hw * 0.15;
  const eyeY = hw * 0.28; // top of the eye row
  const LX = hw * 0.32 - dot / 2; // left eye center at 32%
  const RX = hw * 0.68 - dot / 2; // right eye center at 68%

  const dotAt = (x: number) => (
    <View
      style={{
        position: "absolute",
        top: eyeY,
        left: x,
        width: dot,
        height: dot,
        borderRadius: size,
        backgroundColor: dark,
      }}
    />
  );

  const closedLine = (x: number) => (
    <View
      style={{
        position: "absolute",
        top: eyeY + dot * 0.4,
        left: x - dot * 0.2,
        width: dot * 1.4,
        height: Math.max(2, hw * 0.06),
        borderRadius: size,
        backgroundColor: dark,
      }}
    />
  );

  switch (id) {
    case "happy":
      // closed, smiling arcs ∩ ∩
      return (
        <>
          {[LX, RX].map((x, i) => (
            <View
              key={i}
              style={{
                position: "absolute",
                top: eyeY + dot * 0.3,
                left: x - dot * 0.25,
                width: dot * 1.5,
                height: dot * 0.9,
                backgroundColor: dark,
                borderTopLeftRadius: dot,
                borderTopRightRadius: dot,
              }}
            />
          ))}
        </>
      );
    case "surprised":
      return [LX, RX].map((x, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            top: eyeY - dot * 0.25,
            left: x - dot * 0.3,
            width: dot * 1.6,
            height: dot * 1.6,
            borderRadius: size,
            backgroundColor: "#ffffff",
            borderWidth: Math.max(1.5, hw * 0.05),
            borderColor: dark,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View style={{ width: dot * 0.55, height: dot * 0.55, borderRadius: size, backgroundColor: dark }} />
        </View>
      ));
    case "wink":
      return (
        <>
          {dotAt(LX)}
          {closedLine(RX)}
        </>
      );
    case "squint":
      // > <
      return [LX, RX].map((x, i) => (
        <View key={i} style={{ position: "absolute", top: eyeY - dot * 0.2, left: x - dot * 0.2, width: dot * 1.4, height: dot * 1.4 }}>
          <View
            style={{
              position: "absolute",
              top: dot * 0.5,
              width: dot * 1.2,
              height: Math.max(2, hw * 0.06),
              backgroundColor: dark,
              borderRadius: size,
              transform: [{ rotate: i === 0 ? "30deg" : "-30deg" }, { translateY: i === 0 ? -dot * 0.3 : dot * 0.3 }],
            }}
          />
          <View
            style={{
              position: "absolute",
              top: dot * 0.5,
              width: dot * 1.2,
              height: Math.max(2, hw * 0.06),
              backgroundColor: dark,
              borderRadius: size,
              transform: [{ rotate: i === 0 ? "-30deg" : "30deg" }, { translateY: i === 0 ? dot * 0.3 : -dot * 0.3 }],
            }}
          />
        </View>
      ));
    case "glasses":
      return (
        <View style={{ position: "absolute", top: eyeY - dot * 0.35, left: 0, right: 0, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: hw * 0.04 }}>
          {[0, 1].map((i) => (
            <View
              key={i}
              style={{
                width: dot * 1.9,
                height: dot * 1.9,
                borderRadius: hw * 0.09,
                borderWidth: Math.max(2, hw * 0.07),
                borderColor: dark,
                backgroundColor: "rgba(255,255,255,0.35)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View style={{ width: dot * 0.65, height: dot * 0.65, borderRadius: size, backgroundColor: dark }} />
            </View>
          ))}
        </View>
      );
    case "sleepy":
      return (
        <>
          {closedLine(LX)}
          {closedLine(RX)}
        </>
      );
    case "angry":
      return (
        <>
          {[LX, RX].map((x, i) => (
            <View
              key={i}
              style={{
                position: "absolute",
                top: eyeY - dot * 0.75,
                left: x - dot * 0.15,
                width: dot * 1.3,
                height: Math.max(2, hw * 0.07),
                borderRadius: size,
                backgroundColor: dark,
                transform: [{ rotate: i === 0 ? "-22deg" : "22deg" }],
              }}
            />
          ))}
          {dotAt(LX)}
          {dotAt(RX)}
        </>
      );
    case "love":
      return (
        <View style={{ position: "absolute", top: eyeY - dot * 0.1, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: hw * 0.12 }}>
          <Text style={{ fontSize: hw * 0.22, lineHeight: hw * 0.26 }}>❤️</Text>
          <Text style={{ fontSize: hw * 0.22, lineHeight: hw * 0.26 }}>❤️</Text>
        </View>
      );
    default:
      // "dots" — the classic
      return (
        <>
          {dotAt(LX)}
          {dotAt(RX)}
        </>
      );
  }
}

// ─── Mouth ────────────────────────────────────────────────────────────────────

/** Mouths are centered on the head axis and kept inside the circle's lower half. */
function Mouth({ id, size }: { id: string; size: number }) {
  const dark = INK;
  const hw = size * 0.56; // head width/height
  const cx = hw * 0.5; // head center x
  const top = hw * 0.56; // mouth row top

  switch (id) {
    case "grin":
      // big open smile with teeth
      return (
        <View
          style={{
            position: "absolute",
            top: top - hw * 0.02,
            left: cx - hw * 0.26,
            width: hw * 0.52,
            height: hw * 0.27,
            backgroundColor: dark,
            borderBottomLeftRadius: hw * 0.14,
            borderBottomRightRadius: hw * 0.14,
            borderTopLeftRadius: hw * 0.06,
            borderTopRightRadius: hw * 0.06,
            overflow: "hidden",
            alignItems: "center",
          }}
        >
          <View
            style={{
              position: "absolute",
              top: 0,
              width: "88%",
              height: "46%",
              backgroundColor: "#ffffff",
              borderBottomLeftRadius: hw * 0.05,
              borderBottomRightRadius: hw * 0.05,
            }}
          />
        </View>
      );
    case "squiggle":
      // the ":3" wavy cat mouth — three little tilts
      return (
        <View style={{ position: "absolute", top: top + hw * 0.03, left: cx - hw * 0.28, flexDirection: "row" }}>
          {[-16, 16, -16].map((deg, i) => (
            <View
              key={i}
              style={{
                width: hw * 0.19,
                height: Math.max(2, hw * 0.07),
                borderRadius: size,
                backgroundColor: dark,
                transform: [{ rotate: `${deg}deg` }],
                marginRight: i < 2 ? -hw * 0.025 : 0,
              }}
            />
          ))}
        </View>
      );
    case "open":
      return (
        <View
          style={{
            position: "absolute",
            top,
            left: cx - hw * 0.11,
            width: hw * 0.22,
            height: hw * 0.24,
            backgroundColor: dark,
            borderRadius: hw * 0.11,
          }}
        />
      );
    case "flat":
      return (
        <View
          style={{
            position: "absolute",
            top: top + hw * 0.06,
            left: cx - hw * 0.18,
            width: hw * 0.36,
            height: Math.max(2, hw * 0.06),
            borderRadius: size,
            backgroundColor: dark,
          }}
        />
      );
    case "frown":
      return (
        <View
          style={{
            position: "absolute",
            top: top + hw * 0.04,
            left: cx - hw * 0.2,
            width: hw * 0.4,
            height: hw * 0.2,
            backgroundColor: dark,
            borderTopLeftRadius: hw * 0.14,
            borderTopRightRadius: hw * 0.14,
            borderBottomLeftRadius: 2,
            borderBottomRightRadius: 2,
            transform: [{ rotate: "180deg" }],
          }}
        />
      );
    case "tongue":
      return (
        <View style={{ position: "absolute", top, left: 0, right: 0, alignItems: "center" }}>
          <View
            style={{
              width: hw * 0.44,
              height: hw * 0.22,
              backgroundColor: dark,
              borderBottomLeftRadius: hw * 0.12,
              borderBottomRightRadius: hw * 0.12,
              borderTopLeftRadius: hw * 0.06,
              borderTopRightRadius: hw * 0.06,
              overflow: "hidden",
              alignItems: "center",
            }}
          >
            <View
              style={{
                position: "absolute",
                top: hw * 0.09,
                width: hw * 0.18,
                height: hw * 0.19,
                borderRadius: hw * 0.06,
                backgroundColor: "#e2606b",
              }}
            />
          </View>
        </View>
      );
    default:
      // "smile" — filled half disc
      return (
        <View
          style={{
            position: "absolute",
            top,
            left: cx - hw * 0.2,
            width: hw * 0.4,
            height: hw * 0.22,
            backgroundColor: dark,
            borderBottomLeftRadius: hw * 0.12,
            borderBottomRightRadius: hw * 0.12,
            borderTopLeftRadius: hw * 0.05,
            borderTopRightRadius: hw * 0.05,
          }}
        />
      );
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "flex-end",
  },
  body: {
    position: "absolute",
    bottom: 0,
  },
  head: {
    position: "absolute",
    overflow: "visible",
  },
});
