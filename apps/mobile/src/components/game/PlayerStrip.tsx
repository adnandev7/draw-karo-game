/** Horizontal strip of players: avatar, name, score, host crown / guessed check. */
import { StyleSheet, Text, View } from "react-native";
import type { Player } from "@drawkaro/shared";
import { useGame } from "../../store/game";

export function PlayerStrip({ players }: { players: Player[] }) {
  const me = useGame((s) => s.profile);

  return (
    <View style={styles.row}>
      {players.map((p) => (
        <View key={p.id} style={[styles.card, !p.connected && styles.disconnected]}>
          <View style={[styles.avatar, { backgroundColor: p.avatar.outfitColor }]}>
            <Text style={styles.avatarText}>{p.name.slice(0, 1).toUpperCase()}</Text>
            {p.isHost ? <Text style={styles.badge}>👑</Text> : null}
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {p.id === me.profileId ? "You" : p.name}
          </Text>
          <Text style={styles.score}>{p.score}</Text>
          {p.guessedCurrent ? <Text style={styles.badge}>✅</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  card: {
    alignItems: "center",
    backgroundColor: "#ffffff18",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 56,
  },
  disconnected: { opacity: 0.4 },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  badge: { position: "absolute", right: -4, top: -4, fontSize: 11 },
  name: { color: "#fff", fontSize: 11, fontWeight: "600", marginTop: 2, maxWidth: 64 },
  score: { color: "#ffd700", fontSize: 11, fontWeight: "800" },
});
