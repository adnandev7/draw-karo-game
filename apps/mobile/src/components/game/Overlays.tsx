/**
 * Overlays — skribbl-style: dark veil over the canvas with the word
 * choice buttons, the "word was X" reveal with points, round leaderboard
 * and the winner podium — where 1st place is clearly the greatest
 * (biggest avatar, crown, tallest gold block, winner bounce).
 */
import { useEffect, useMemo, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import type { LeaderboardEntry, TurnResultEntry } from "@drawkaro/shared";
import { t } from "../../lib/strings";
import { useGame } from "../../store/game";
import { Avatar } from "../Avatar";
import { C, F, R, shade } from "../../lib/theme";

function Veil({ children }: { children: React.ReactNode }) {
  return <View style={styles.veil}>{children}</View>;
}

export function WordChoiceOverlay({ words }: { words: string[] }) {
  const choose = useGame((s) => s.chooseWord);
  return (
    <Veil>
      <Text style={styles.heading}>{t.yourTurn}</Text>
      <Text style={styles.sub}>{t.pickWordSub}</Text>
      <View style={styles.choiceRowWrap}>
        {words.map((w, i) => (
          <WordButton key={w} word={w} onPress={() => choose(i)} />
        ))}
      </View>
    </Veil>
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
});
