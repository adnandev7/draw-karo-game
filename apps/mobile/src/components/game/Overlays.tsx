/** Full-screen overlays: word choice, turn end, round end, game podium. */
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { LeaderboardEntry, TurnResultEntry } from "@drawkaro/shared";
import { useGame } from "../../store/game";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export function WordChoiceOverlay({ words }: { words: string[] }) {
  const choose = useGame((s) => s.chooseWord);
  return (
    <Card>
      <Text style={styles.heading}>Tumhari baari! 🎨</Text>
      <Text style={styles.sub}>Ek word chuno aur banao</Text>
      {words.map((w) => (
        <Pressable key={w} style={styles.choice} onPress={() => choose(words.indexOf(w))}>
          <Text style={styles.choiceText}>{w}</Text>
        </Pressable>
      ))}
    </Card>
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
    <Card>
      <Text style={styles.sub}>The word was</Text>
      <Text style={styles.bigWord}>{word}</Text>
      <Text style={styles.sub}>Drawn by {nameOf(drawerId)}</Text>
      <View style={styles.results}>
        {results.map((r) => {
          const p = room?.players.find((pl) => pl.id === r.playerId);
          return (
            <View key={r.playerId} style={styles.resultRow}>
              <Text style={styles.resultName}>{p?.name ?? "?"}</Text>
              <Text style={styles.resultPoints}>
                {r.pointsEarned > 0 ? `+${r.pointsEarned}` : "—"}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.sub}>Next turn aane wala hai...</Text>
    </Card>
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
    <Card>
      <Text style={styles.heading}>Round {round} khatam! 🏁</Text>
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
    </Card>
  );
}

export function GameEndOverlay({ podium }: { podium: LeaderboardEntry[] }) {
  return (
    <Card>
      <Text style={styles.heading}>🏆 Winner Winner!</Text>
      {podium.slice(0, 3).map((e) => (
        <View key={e.playerId} style={styles.resultRow}>
          <Text style={styles.resultName}>
            {medal(e.rank)} {e.name}
          </Text>
          <Text style={styles.resultPoints}>{e.score}</Text>
        </View>
      ))}
      <Text style={styles.sub}>Rematch lobby mein aa raha hai...</Text>
    </Card>
  );
}

function medal(rank: number): string {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}.`;
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0b2545cc",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#123a6b",
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    gap: 8,
    borderWidth: 2,
    borderColor: "#2c8ad8",
  },
  heading: { color: "#ffd700", fontSize: 22, fontWeight: "900", textAlign: "center" },
  sub: { color: "#9fc9f5", fontSize: 14, textAlign: "center" },
  bigWord: { color: "#ffffff", fontSize: 28, fontWeight: "900", textAlign: "center" },
  results: { alignSelf: "stretch", marginTop: 6, gap: 4 },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#ffffff10",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resultName: { color: "#fff", fontWeight: "700", fontSize: 15 },
  resultPoints: { color: "#ffd700", fontWeight: "900", fontSize: 15 },
  choice: {
    backgroundColor: "#ffd700",
    borderRadius: 14,
    paddingVertical: 12,
    alignSelf: "stretch",
    alignItems: "center",
    marginTop: 4,
  },
  choiceText: { color: "#0b2545", fontWeight: "900", fontSize: 16 },
});
