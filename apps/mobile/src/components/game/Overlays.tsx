/**
 * Overlays — skribbl-style: dark veil over the canvas with the word
 * choice buttons, the "word was X" reveal with points, round leaderboard
 * and the winner podium — where 1st place is clearly the greatest
 * (biggest avatar, crown, tallest gold block, winner bounce).
 */
import { useEffect, useMemo, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import type { AvatarDescriptor, LeaderboardEntry, TurnResultEntry } from "@drawkaro/shared";
import { t } from "../../lib/strings";
import { useGame } from "../../store/game";
import { Avatar } from "../Avatar";
import { C, F, R, shade } from "../../lib/theme";

function Veil({ children }: { children: React.ReactNode }) {
  return <View style={styles.veil}>{children}</View>;
}

export function WordChoiceOverlay({ words, seconds }: { words: string[]; seconds: number }) {
  const choose = useGame((s) => s.chooseWord);
  return (
    <Veil>
      <Text style={styles.heading}>{t.yourTurn}</Text>
      <Text style={styles.sub}>{t.pickWordSub}</Text>
      <FunkyClock seconds={seconds} />
      <View style={styles.choiceRowWrap}>
        {words.map((w, i) => (
          <WordButton key={w} word={w} onPress={() => choose(i)} />
        ))}
      </View>
    </Veil>
  );
}

/**
 * Cartoon alarm clock for the word-choice countdown — skribbl's white
 * round clock, funkified: chunky dark rim, bells on top, little feet,
 * and a fast squash-pulse that speeds up when time is running out.
 */
function FunkyClock({ seconds }: { seconds: number }) {
  const urgent = seconds <= 5;
  const pulse = useClockPulse(urgent ? 450 : 900);
  const wobble = useClockWobble();
  return (
    <View style={styles.clockRow}>
      <Animated.View
        style={[
          styles.funkyClock,
          urgent && styles.funkyClockUrgent,
          {
            transform: [
              { scale: pulse },
              { rotate: wobble },
            ],
          },
        ]}
      >
        {/* alarm bells */}
        <View style={[styles.bell, styles.bellL]} />
        <View style={[styles.bell, styles.bellR]} />
        <Text style={styles.funkyClockNum}>{Math.max(0, seconds)}</Text>
        {/* little feet */}
        <View style={[styles.foot, styles.footL]} />
        <View style={[styles.foot, styles.footR]} />
      </Animated.View>
      <Text style={styles.pickFast}>{t.pickFast}</Text>
    </View>
  );
}

function WordButton({ word, onPress }: { word: string; onPress: () => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      style={[styles.choice, pressed && styles.choicePressed]}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
    >
      <Text style={[styles.choiceText, pressed && styles.choiceTextPressed]}>{word}</Text>
    </Pressable>
  );
}

/**
 * Skribbl's "X is choosing a word!" screen: the whole room fades behind a
 * heavy dark veil, hand-drawn arrows point at the drawer's avatar, and the
 * avatar jitters fast (~130ms steps) — the fast cartoonish twitch.
 */
export function ChoosingOverlay({
  name,
  avatar,
}: {
  name: string;
  avatar: AvatarDescriptor | null;
}) {
  const jitter = useJitter();
  return (
    <View style={styles.choosingVeil}>
      <Text style={styles.heading}>{t.choosingWord(name)}</Text>
      <View style={styles.choosingRow}>
        <Chevrons dir="left" wiggle={jitter} />
        {avatar ? (
          <Animated.View
            style={{
              transform: [
                { rotate: jitter.interpolate({ inputRange: [-1, 1], outputRange: ["-9deg", "9deg"] }) },
                { translateX: jitter.interpolate({ inputRange: [-1, 1], outputRange: [-3, 3] }) },
              ],
            }}
          >
            <Avatar avatar={avatar} size={92} />
          </Animated.View>
        ) : null}
        <Chevrons dir="right" wiggle={jitter} />
      </View>
      <Text style={styles.sub}>{t.pickWordSub}</Text>
    </View>
  );
}

/** Hand-drawn style chevrons flanking the avatar — outer one dimmer. */
function Chevrons({ dir, wiggle }: { dir: "left" | "right"; wiggle: Animated.Value }) {
  const flip = dir === "left";
  const arm = (dim: boolean) => (
    <View
      style={{
        width: 20,
        height: 20,
        borderRightWidth: 5,
        borderTopWidth: 5,
        borderColor: dim ? "rgba(255,255,255,0.45)" : "#ffffff",
        transform: [{ rotate: flip ? "-135deg" : "45deg" }],
      }}
    />
  );
  return (
    <Animated.View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        transform: [{ translateX: wiggle.interpolate({ inputRange: [-1, 1], outputRange: flip ? [2, -2] : [-2, 2] }) }],
      }}
    >
      {arm(true)}
      {arm(false)}
    </Animated.View>
  );
}

export function TurnEndOverlay({
  word,
  drawerId,
  results,
}: {
  word: string;
  drawerId: string;
  results: TurnResultEntry[];
}) {
  const room = useGame((s) => s.room);
  const nameOf = (id: string) => room?.players.find((p) => p.id === id)?.name ?? "someone";
  return (
    <Veil>
      <Text style={styles.sub}>{t.theWordWas}</Text>
      <Text style={styles.bigWord}>{word}</Text>
      <Text style={styles.subDim}>{t.drawnBy(nameOf(drawerId))}</Text>
      <View style={styles.results}>
        {results.map((r) => {
          const p = room?.players.find((pl) => pl.id === r.playerId);
          return (
            <View key={r.playerId} style={styles.resultRow}>
              <Text style={styles.resultName}>{p?.name ?? "?"}</Text>
              <Text style={[styles.resultPoints, r.pointsEarned <= 0 && styles.resultZero]}>
                {r.pointsEarned > 0 ? `+${r.pointsEarned}` : "0"}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.subDim}>{t.nextTurnComing}</Text>
    </Veil>
  );
}

export function RoundEndOverlay({
  round,
  leaderboard,
}: {
  round: number;
  leaderboard: LeaderboardEntry[];
}) {
  return (
    <Veil>
      <Text style={styles.heading}>{t.roundDone(round)}</Text>
      <View style={styles.results}>
        {leaderboard.map((e) => (
          <View key={e.playerId} style={styles.resultRow}>
            <Text style={styles.resultName}>
              {medal(e.rank)} {e.name}
            </Text>
            <Text style={styles.resultPoints}>{e.score}</Text>
          </View>
        ))}
      </View>
    </Veil>
  );
}

export function GameEndOverlay({ podium }: { podium: LeaderboardEntry[] }) {
  const room = useGame((s) => s.room);
  const top = podium.slice(0, 3);
  const avatarOf = (id: string) => room?.players.find((p) => p.id === id)?.avatar;
  const trophy = useWobble();
  const winnerBounce = useWinnerBounce(!!top[0]);

  // podium order on screen: 2nd, 1st, 3rd — 1st clearly the greatest
  const order = [top[1], top[0], top[2]].filter(Boolean);
  const meta: Record<number, { size: number; blockH: number; color: string }> = {
    1: { size: 72, blockH: 92, color: C.gold },
    2: { size: 48, blockH: 62, color: C.silver },
    3: { size: 42, blockH: 44, color: C.bronze },
  };

  return (
    <Veil>
      <Animated.Text style={[styles.trophy, { transform: [{ rotate: trophy }] }]}>🏆</Animated.Text>
      <Text style={styles.heading}>{t.winnerWinner}</Text>
      <View style={styles.podiumRow}>
        {order.map((e) => {
          const m = meta[e.rank] ?? meta[3];
          const isWinner = e.rank === 1;
          // skribbl's player_winner: ±10% sideways hop, −50% rise
          const dance = isWinner
            ? {
                transform: [
                  { translateX: winnerBounce.interpolate({ inputRange: WINNER_T, outputRange: WINNER_TX.map((v) => (v / 100) * m.size) }) },
                  { translateY: winnerBounce.interpolate({ inputRange: WINNER_T, outputRange: WINNER_TY.map((v) => (v / 100) * m.size) }) },
                  { rotate: winnerBounce.interpolate({ inputRange: WINNER_T, outputRange: WINNER_R.map((d) => `${d}deg`) }) },
                  { scaleX: winnerBounce.interpolate({ inputRange: WINNER_T, outputRange: WINNER_SX }) },
                  { scaleY: winnerBounce.interpolate({ inputRange: WINNER_T, outputRange: WINNER_SY }) },
                ],
              }
            : undefined;
          return (
            <View key={e.playerId} style={styles.podiumCol}>
              {isWinner ? <Text style={styles.winCrown}>👑</Text> : null}
              {avatarOf(e.playerId) ? (
                <Animated.View style={dance}>
                  <Avatar avatar={avatarOf(e.playerId)!} size={m.size} />
                </Animated.View>
              ) : null}
              <Text style={[styles.podiumName, isWinner && styles.podiumNameWin, { color: m.color }]} numberOfLines={1}>
                {e.name}
              </Text>
              <Text style={[styles.podiumScore, isWinner && styles.podiumScoreWin]}>{e.score}</Text>
              <View
                style={[
                  styles.podiumBlock,
                  {
                    height: m.blockH,
                    borderTopColor: m.color,
                    borderLeftColor: shade(m.color, 0.25),
                    borderRightColor: shade(m.color, 0.25),
                    borderTopLeftRadius: isWinner ? 16 : 10,
                    borderTopRightRadius: isWinner ? 16 : 10,
                  },
                ]}
              >
                <Text style={[styles.podiumRank, { color: m.color }, isWinner && styles.podiumRankWin]}>
                  {e.rank}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
      {podium.slice(3).length ? (
        <Text style={styles.subDim}>
          {podium
            .slice(3)
            .map((e) => `${e.rank}. ${e.name}`)
            .join("  ·  ")}
        </Text>
      ) : null}
      <Text style={styles.subDim}>{t.rematchComing}</Text>
    </Veil>
  );
}

function medal(rank: number): string {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}.`;
}

// ─── Motion ───────────────────────────────────────────────────────────────────

/** Squash-pop pulse for the funky clock — `periodMs` speeds up when urgent. */
function useClockPulse(periodMs: number) {
  const val = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(val, { toValue: 1, duration: periodMs / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(val, { toValue: 0, duration: periodMs / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [val, periodMs]);
  return val.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.14, 1] });
}

/** Ticking wobble — quick ±7° swings like an excited alarm clock. */
function useClockWobble() {
  const val = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(val, { toValue: 1, duration: 140, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(val, { toValue: -1, duration: 280, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(val, { toValue: 1, duration: 280, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(val, { toValue: 0, duration: 140, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [val]);
  return val.interpolate({ inputRange: [-1, 1], outputRange: ["-7deg", "7deg"] });
}

/**
 * Fast cartoonish jitter — a quick ±1 sweep in ~130ms steps, looping.
 * Drives the drawer avatar's twitch on the "choosing a word" screen.
 */
function useJitter() {
  const val = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(val, { toValue: 1, duration: 130, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(val, { toValue: -1, duration: 240, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(val, { toValue: 1, duration: 240, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(val, { toValue: 0, duration: 130, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [val]);
  return val;
}

function useWobble() {
  const val = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(val, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(val, { toValue: -1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(val, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [val]);
  return val.interpolate({ inputRange: [-1, 1], outputRange: ["-14deg", "14deg"] });
}

// skribbl's player_winner keyframes, normalized to one 0..1 loop (3.8s):
// squash-pop → tilt-jump right → big squash → rest → same to the left
const WINNER_T = [0, 0.05, 0.08, 0.14, 0.16, 0.24, 0.26, 0.28, 0.38, 0.42, 0.48, 0.5, 0.58, 0.6, 0.62, 1];
const WINNER_R = [0, 0, 0, 20, 20, 0, 0, 0, 0, 0, -20, -20, 0, 0, 0, 0];
const WINNER_SX = [1, 1.2, 1.2, 0.8, 0.8, 1.4, 1.4, 1, 1, 1.2, 0.8, 0.8, 1.4, 1.4, 1, 1];
const WINNER_SY = [1, 0.8, 0.8, 1.2, 1.2, 0.7, 0.7, 1, 1, 0.8, 1.2, 1.2, 0.7, 0.7, 1, 1];
const WINNER_TX = [0, 0, 0, 10, 10, 0, 0, 0, 0, 0, -10, -10, 0, 0, 0, 0];
const WINNER_TY = [0, 0, 0, -50, -50, 0, 0, 0, 0, 0, -50, -50, 0, 0, 0, 0];

function useWinnerBounce(active: boolean) {
  const val = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    if (!active) {
      val.setValue(0);
      return;
    }
    val.setValue(0);
    const anim = Animated.loop(
      Animated.timing(val, { toValue: 1, duration: 3800, easing: Easing.linear, useNativeDriver: true })
    );
    anim.start();
    return () => anim.stop();
  }, [active, val]);
  return val;
}

const styles = StyleSheet.create({
  veil: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 8,
  },
  heading: {
    color: "#ffffff",
    fontFamily: F.black,
    fontSize: 24,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  trophy: { fontSize: 56 },
  sub: {
    color: "#ffffff",
    fontFamily: F.bold,
    fontSize: 15,
    textAlign: "center",
  },
  subDim: {
    color: "#d6d6d6",
    fontFamily: F.regular,
    fontSize: 12,
    textAlign: "center",
  },
  bigWord: {
    color: "#ffdfb4",
    fontFamily: F.black,
    fontSize: 30,
    textAlign: "center",
  },
  choiceRowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 6,
  },
  choice: {
    borderWidth: 2,
    borderColor: "#ffffff",
    borderRadius: R.pill,
    paddingHorizontal: 20,
    paddingVertical: 10,
    margin: 3,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  choicePressed: { backgroundColor: "#ffffff" },
  choiceText: {
    color: "#ffffff",
    fontFamily: F.black,
    fontSize: 19,
  },
  choiceTextPressed: { color: C.canvasInk },
  results: { alignSelf: "stretch", maxWidth: 320, gap: 4, marginTop: 4 },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: R.s + 2,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  resultName: {
    color: "#ffffff",
    fontFamily: F.bold,
    fontSize: 14,
  },
  resultPoints: {
    color: "#17db17",
    fontFamily: F.black,
    fontSize: 14,
  },
  resultZero: { color: "#e01313" },
  podiumRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    marginVertical: 10,
  },
  podiumCol: { alignItems: "center", width: 104 },
  winCrown: { fontSize: 26, marginBottom: -18, zIndex: 2 },
  podiumName: {
    fontFamily: F.xbold,
    fontSize: 12,
    marginTop: 4,
  },
  podiumNameWin: { fontSize: 15 },
  podiumScore: {
    color: "#ffffff",
    fontFamily: F.bold,
    fontSize: 11,
  },
  podiumScoreWin: { fontSize: 14, color: C.gold },
  podiumBlock: {
    alignSelf: "stretch",
    borderTopWidth: 5,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    justifyContent: "flex-start",
    alignItems: "flex-start",
    padding: 5,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  podiumRank: { fontFamily: F.black, fontSize: 15 },
  podiumRankWin: { fontSize: 20 },
  // choosing-a-word screen — heavier veil than the standard overlay
  choosingVeil: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(3,8,29,0.82)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 14,
  },
  choosingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 22,
  },
  countdownPill: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 2,
    borderColor: "#ffffff",
    borderRadius: R.pill,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  countdownUrgent: {
    backgroundColor: "rgba(224,19,19,0.55)",
    borderColor: "#ff9b9b",
  },
  countdownText: {
    color: "#ffffff",
    fontFamily: F.xbold,
    fontSize: 15,
  },
  // funky cartoon alarm clock
  clockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  funkyClock: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#ffffff",
    borderWidth: 4,
    borderColor: "#1d2b4f",
    alignItems: "center",
    justifyContent: "center",
  },
  funkyClockUrgent: {
    borderColor: "#e01313",
    backgroundColor: "#ffe9e9",
  },
  funkyClockNum: {
    color: "#1d2b4f",
    fontFamily: F.black,
    fontSize: 26,
  },
  bell: {
    position: "absolute",
    top: -7,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#1d2b4f",
  },
  bellL: { left: 2, transform: [{ rotate: "-35deg" }] },
  bellR: { right: 2, transform: [{ rotate: "35deg" }] },
  foot: {
    position: "absolute",
    bottom: -6,
    width: 10,
    height: 8,
    borderRadius: 3,
    backgroundColor: "#1d2b4f",
  },
  footL: { left: 10, transform: [{ rotate: "20deg" }] },
  footR: { right: 10, transform: [{ rotate: "-20deg" }] },
  pickFast: {
    color: "#ffffff",
    fontFamily: F.xbold,
    fontSize: 17,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
