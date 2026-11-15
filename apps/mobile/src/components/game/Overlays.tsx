/**
 * Overlays — skribbl-style: dark veil over the canvas with the word
 * choice buttons, the "word was X" reveal with points, round leaderboard
 * and the winner podium with trophy.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import type { LeaderboardEntry, TurnResultEntry } from "@drawkaro/shared";
import { t } from "../../lib/strings";
import { useGame } from "../../store/game";
import { Avatar } from "../Avatar";
import { C, F } from "../../lib/theme";

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
  // podium order on screen: 2nd, 1st, 3rd
  const order = [top[1], top[0], top[2]].filter(Boolean);
  const heights = ["58%", "84%", "44%"];
  const colors = [C.silver, C.yellow, C.bronze];

  return (
    <Veil>
      <Text style={styles.trophy}>🏆</Text>
      <Text style={styles.heading}>{t.winnerWinner}</Text>
      <View style={styles.podiumRow}>
        {order.map((e, i) => (
          <View key={e.playerId} style={styles.podiumCol}>
            {avatarOf(e.playerId) ? <Avatar avatar={avatarOf(e.playerId)!} size={i === 1 ? 64 : 46} /> : null}
            <Text style={[styles.podiumName, { color: colors[i] }]} numberOfLines={1}>
              {e.name}
            </Text>
            <Text style={styles.podiumScore}>{e.score}</Text>
            <View style={[styles.podiumBlock, { height: heights[i], borderColor: colors[i] }]}>
              <Text style={[styles.podiumRank, { color: colors[i] }]}>{e.rank}</Text>
            </View>
          </View>
        ))}
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
  trophy: { fontSize: 52 },
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
    borderRadius: 3,
    paddingHorizontal: 16,
    paddingVertical: 10,
    margin: 3,
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
    borderRadius: 4,
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
    gap: 10,
    marginVertical: 8,
  },
  podiumCol: { alignItems: "center", width: 92 },
  podiumName: {
    fontFamily: F.xbold,
    fontSize: 12,
    marginTop: 4,
  },
  podiumScore: {
    color: "#ffffff",
    fontFamily: F.bold,
    fontSize: 11,
  },
  podiumBlock: {
    alignSelf: "stretch",
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    justifyContent: "flex-start",
    alignItems: "flex-start",
    padding: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  podiumRank: { fontFamily: F.black, fontSize: 16 },
});
