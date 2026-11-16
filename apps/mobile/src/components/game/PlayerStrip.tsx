/**
 * PlayerList — skribbl-style player rows (wide screens) or a compact
 * horizontal strip (phones). Guessed players glow green with a ✔ before
 * the avatar, rows read `#N · name · points` centered like skribbl,
 * the drawer gets a wiggling pen, the host wears a crown. Recent chat
 * messages pop up as speech bubbles beside the sender's row.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import type { ChatEntry, Player } from "@drawkaro/shared";
import { useGame } from "../../store/game";
import { Avatar } from "../Avatar";
import { t } from "../../lib/strings";
import { C, F, R } from "../../lib/theme";

/** How long a sent message keeps showing beside the player's name. */
const BUBBLE_MS = 6000;

export function PlayerList({
  players,
  drawerId,
  layout,
  chat,
}: {
  players: Player[];
  drawerId: string | null;
  layout: "rows" | "strip";
  chat?: ChatEntry[];
}) {
  const me = useGame((s) => s.profile);
  const bubbles = useRecentChats(chat);
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const rankOf = (id: string) => sorted.findIndex((p) => p.id === id) + 1;

  if (layout === "strip") {
    return (
      <View style={styles.stripRow}>
        {players.map((p) => (
          <StripCard
            key={p.id}
            p={p}
            me={p.id === me.profileId}
            drawing={p.id === drawerId}
            rank={rankOf(p.id)}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.rowsWrap}>
      {players.map((p, i) => (
        <PlayerRow
          key={p.id}
          p={p}
          me={p.id === me.profileId}
          drawing={p.id === drawerId}
          rank={rankOf(p.id)}
          first={i === 0}
          last={i === players.length - 1}
          bubble={bubbles[p.id]}
        />
      ))}
    </View>
  );
}

/**
 * Latest typed message per player, still fresh enough to show as a bubble.
 * A light 300ms interval re-evaluates liveness; it only re-renders when the
 * set of visible bubbles actually changes.
 */
function useRecentChats(chat: ChatEntry[] | undefined): Record<string, string> {
  const latest = useMemo(() => {
    const map: Record<string, { text: string; ts: number }> = {};
    for (const e of chat ?? []) {
      if (e.kind !== "chat") continue;
      map[e.playerId] = { text: e.text, ts: e.ts };
    }
    return map;
  }, [chat]);

  const [live, setLive] = useState<Record<string, string>>({});
  const liveRef = useRef<Record<string, string>>({});
  useEffect(() => {
    liveRef.current = live;
  }, [live]);

  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      const out: Record<string, string> = {};
      for (const [id, v] of Object.entries(latest)) {
        if (now - v.ts < BUBBLE_MS) out[id] = v.text;
      }
      const prev = liveRef.current;
      const prevKeys = Object.keys(prev);
      const outKeys = Object.keys(out);
      if (
        prevKeys.length === outKeys.length &&
        outKeys.every((k) => prev[k] === out[k])
      ) {
        return;
      }
      setLive(out);
    }, 300);
    return () => clearInterval(iv);
  }, [latest]);

  return live;
}

function useWiggle(active: boolean) {
  const val = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    if (!active) {
      val.setValue(0);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(val, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(val, { toValue: -1, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(val, { toValue: 0, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [active, val]);
  return val.interpolate({ inputRange: [-1, 1], outputRange: ["-10deg", "10deg"] });
}

function PlayerRow({
  p,
  me,
  drawing,
  rank,
  first,
  last,
  bubble,
}: {
  p: Player;
  me: boolean;
  drawing: boolean;
  rank: number;
  first: boolean;
  last: boolean;
  bubble?: string;
}) {
  const wiggle = useWiggle(drawing);
  const bg = p.guessedCurrent
    ? rank % 2 === 0
      ? C.guessedRowAlt
      : C.guessedRow
    : rank % 2 === 0
      ? C.chatRowAlt
      : "#ffffff";

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: bg },
        first && styles.rowFirst,
        last && styles.rowLast,
        !p.connected && styles.dim,
      ]}
    >
      <Text style={[styles.rank, me && styles.rankMe]} numberOfLines={1}>
        #{rank}
      </Text>

      {/* centered name + points, like skribbl's green rows */}
      <View style={styles.center}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, me && styles.nameMe]} numberOfLines={1}>
            {p.name}
            {me ? " (You)" : ""}
          </Text>
          {p.isHost ? <Text style={styles.crown}>👑</Text> : null}
          {drawing ? (
            <Animated.Text style={[styles.pen, { transform: [{ rotate: wiggle }] }]}>✏️</Animated.Text>
          ) : null}
        </View>
        <Text style={styles.score}>{t.points(p.score)}</Text>
      </View>

      {/* ✔ inline before the avatar — no absolute overlap */}
      {p.guessedCurrent ? <Text style={styles.check}>✔</Text> : null}
      <Avatar avatar={p.avatar} size={32} />
      {/* skribbl's speech bubble beside the row of whoever just typed */}
      {bubble ? (
        <View style={styles.bubble} pointerEvents="none">
          <Text style={styles.bubbleText} numberOfLines={2}>
            {bubble}
          </Text>
          <View style={styles.bubbleTail} />
        </View>
      ) : null}
    </View>
  );
}

function StripCard({
  p,
  me,
  drawing,
  rank,
}: {
  p: Player;
  me: boolean;
  drawing: boolean;
  rank: number;
}) {
  const wiggle = useWiggle(drawing);
  return (
    <View
      style={[
        styles.card,
        p.guessedCurrent && styles.cardGuessed,
        !p.connected && styles.dim,
      ]}
    >
      <Text style={[styles.cardRank, me && styles.rankMe]}>#{rank}</Text>
      <Avatar avatar={p.avatar} size={26} />
      <View style={styles.cardMeta}>
        <View style={styles.nameRow}>
          <Text style={[styles.cardName, me && styles.nameMe]} numberOfLines={1}>
            {p.name}
          </Text>
          {p.isHost ? <Text style={styles.crown}>👑</Text> : null}
          {drawing ? (
            <Animated.Text style={[styles.pen, { transform: [{ rotate: wiggle }] }]}>✏️</Animated.Text>
          ) : null}
        </View>
        <Text style={styles.cardScore}>{p.score}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // vertical rows (skribbl sidebar)
  rowsWrap: {
    borderRadius: R.m,
    borderWidth: 1,
    borderColor: C.panelBorder,
    // visible: chat bubbles overhang the panel edge onto the canvas
    overflow: "visible",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    height: 52,
  },
  rowFirst: { borderTopLeftRadius: R.m - 1, borderTopRightRadius: R.m - 1 },
  rowLast: { borderBottomLeftRadius: R.m - 1, borderBottomRightRadius: R.m - 1 },
  dim: { opacity: 0.45 },
  rank: {
    width: 22,
    color: "#6b6b6b",
    fontFamily: F.xbold,
    fontSize: 13,
  },
  rankMe: { color: C.meGuessed },
  center: {
    flex: 1,
    alignItems: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  name: {
    color: "#111111",
    fontFamily: F.xbold,
    fontSize: 13,
    flexShrink: 1,
  },
  nameMe: { color: C.meGuessed },
  // emoji sit on a low baseline next to text — nudge up to true-center
  crown: { fontSize: 11, lineHeight: 12, transform: [{ translateY: -1 }] },
  pen: { fontSize: 12, lineHeight: 13, transform: [{ translateY: -1 }] },
  score: {
    color: "#555555",
    fontFamily: F.semibold,
    fontSize: 11,
  },
  check: {
    color: "#1c7a12",
    fontFamily: F.black,
    fontSize: 16,
  },
  // speech bubble beside whoever just typed (skribbl)
  bubble: {
    position: "absolute",
    left: "58%",
    top: 7,
    maxWidth: 150,
    zIndex: 30,
  },
  bubbleText: {
    color: "#111111",
    fontFamily: F.semibold,
    fontSize: 12,
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#e3e3e3",
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 5,
    overflow: "hidden",
  },
  bubbleTail: {
    position: "absolute",
    left: -4,
    top: 10,
    width: 10,
    height: 10,
    backgroundColor: "#ffffff",
    transform: [{ rotate: "45deg" }],
  },

  // horizontal strip (phones)
  stripRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ffffff",
    borderRadius: R.m,
    borderWidth: 1,
    borderColor: C.panelBorder,
    paddingHorizontal: 8,
    paddingVertical: 5,
    minWidth: 104,
  },
  cardGuessed: { backgroundColor: C.guessedRow },
  cardRank: {
    color: "#6b6b6b",
    fontFamily: F.xbold,
    fontSize: 11,
  },
  cardMeta: { flexShrink: 1 },
  cardName: {
    color: "#111111",
    fontFamily: F.xbold,
    fontSize: 11,
    maxWidth: 72,
  },
  cardScore: {
    color: "#555555",
    fontFamily: F.semibold,
    fontSize: 10,
  },
});
