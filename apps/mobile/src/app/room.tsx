/**
 * Room screen — renders lobby or game based on the server phase.
 * All state comes from the store (server snapshots); no local game logic.
 */
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { availablePackIds, WORD_PACKS } from "@drawkaro/words";
import type { WordPackId } from "@drawkaro/shared";
import { t } from "../lib/strings";
import { useGame } from "../store/game";
import { DrawCanvasLazy } from "../components/game/DrawCanvasLazy";
import { Toolbar } from "../components/game/Toolbar";
import { ChatPanel } from "../components/game/ChatPanel";
import { PlayerStrip } from "../components/game/PlayerStrip";
import {
  GameEndOverlay,
  RoundEndOverlay,
  TurnEndOverlay,
  WordChoiceOverlay,
} from "../components/game/Overlays";

export default function RoomScreen() {
  const router = useRouter();
  const room = useGame((s) => s.room);
  const profile = useGame((s) => s.profile);
  const leaveRoom = useGame((s) => s.leaveRoom);
  const errorMsg = useGame((s) => s.errorMsg);
  const myWordOptions = useGame((s) => s.myWordOptions);
  const turnEnd = useGame((s) => s.turnEnd);
  const roundEnd = useGame((s) => s.roundEnd);
  const gameEnd = useGame((s) => s.gameEnd);

  useEffect(() => {
    if (!room) router.replace("/");
  }, [room, router]);

  if (!room) return null;

  const isHost = room.players.find((p) => p.id === profile.profileId)?.isHost ?? false;
  const isDrawer = room.drawerId === profile.profileId;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Header code={room.code} phase={room.phase} round={room.round} total={room.settings.rounds} />
      {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

      {room.phase === "lobby" ? (
        <LobbyView isHost={isHost} />
      ) : (
        <GameView isDrawer={isDrawer} />
      )}

      {/* overlays */}
      {room.phase === "selecting" && isDrawer && myWordOptions ? (
        <WordChoiceOverlay words={myWordOptions} />
      ) : null}
      {room.phase === "turnEnd" && turnEnd ? (
        <TurnEndOverlay word={turnEnd.word} drawerId={turnEnd.drawerId} results={turnEnd.results} />
      ) : null}
      {room.phase === "roundEnd" && roundEnd ? (
        <RoundEndOverlay round={roundEnd.round} leaderboard={roundEnd.leaderboard} />
      ) : null}
      {room.phase === "gameEnd" && gameEnd ? <GameEndOverlay podium={gameEnd.podium} /> : null}

      <Pressable style={styles.leave} onPress={leaveRoom}>
        <Text style={styles.leaveText}>🚪 Leave</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

function Header({
  code,
  phase,
  round,
  total,
}: {
  code: string;
  phase: string;
  round: number;
  total: number;
}) {
  return (
    <View style={styles.header}>
      <Text style={styles.code}>#{code}</Text>
      <Text style={styles.phase}>
        {phase === "lobby"
          ? t.lobby
          : phase === "selecting"
            ? t.pickingWord
            : phase === "drawing"
              ? t.roundLabel(round, total)
              : t.waitingNext}
      </Text>
    </View>
  );
}

function LobbyView({ isHost }: { isHost: boolean }) {
  const room = useGame((s) => s.room)!;
  const startGame = useGame((s) => s.startGame);
  const updateSettings = useGame((s) => s.updateSettings);
  const sendChat = useGame((s) => s.sendChat);
  const canStart = room.players.length >= 2;

  const togglePack = (id: WordPackId) => {
    const packs = room.settings.packs.includes(id)
      ? room.settings.packs.filter((p) => p !== id)
      : [...room.settings.packs, id];
    updateSettings({ packs: packs.length ? packs : [id] });
  };

  return (
    <ScrollView style={styles.lobby} contentContainerStyle={styles.lobbyContent}>
      <View style={styles.inviteCard}>
        <Text style={styles.inviteLabel}>{t.inviteLabel}</Text>
        <Text style={styles.inviteCode}>{room.code}</Text>
      </View>

      <Text style={styles.sectionTitle}>
        {t.players} ({room.players.length}/{room.settings.maxPlayers})
      </Text>
      <PlayerStrip players={room.players} />

      {isHost ? (
        <>
          <Text style={styles.sectionTitle}>{t.settingsHostOnly}</Text>
          <View style={styles.settingsCard}>
            <Stepper
              label={t.rounds}
              value={room.settings.rounds}
              onChange={(v) => updateSettings({ rounds: v })}
            />
            <Stepper
              label={t.drawTime}
              value={room.settings.drawTimeSec}
              step={10}
              onChange={(v) => updateSettings({ drawTimeSec: v })}
            />
            <Stepper
              label={t.hints}
              value={room.settings.hints}
              max={3}
              onChange={(v) => updateSettings({ hints: v })}
            />
            <Text style={styles.settingLabel}>{t.wordPacks}</Text>
            <View style={styles.packRow}>
              {availablePackIds().map((id) => (
                <Pressable
                  key={id}
                  style={[
                    styles.packChip,
                    room.settings.packs.includes(id) && styles.packChipOn,
                  ]}
                  onPress={() => togglePack(id)}
                >
                  <Text style={[styles.packText, room.settings.packs.includes(id) && styles.packTextOn]}>
                    {WORD_PACKS[id]?.emoji} {WORD_PACKS[id]?.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.settingHint}>{t.insideJokeHint}</Text>
          </View>
        </>
      ) : (
        <Text style={styles.hostNote}>
          {t.hostControls(room.players.find((p) => p.isHost)?.name ?? "?")}
        </Text>
      )}

      <Pressable
        style={[styles.startBtn, (!canStart || !isHost) && styles.disabled]}
        disabled={!canStart || !isHost}
        onPress={startGame}
      >
        <Text style={styles.startText}>
          {!isHost ? t.waitingForHost : !canStart ? t.needPlayers : t.startGame}
        </Text>
      </Pressable>

      <ChatPanel
        entries={room.chat}
        isDrawer={false}
        guessedCurrent={false}
        onSubmit={sendChat}
      />
    </ScrollView>
  );
}

function GameView({ isDrawer }: { isDrawer: boolean }) {
  const room = useGame((s) => s.room)!;
  const profile = useGame((s) => s.profile);
  const myWord = useGame((s) => s.myWord);
  const closeHint = useGame((s) => s.closeHint);
  const pushStrokeBatch = useGame((s) => s.pushStrokeBatch);
  const undoStroke = useGame((s) => s.undoStroke);
  const clearCanvas = useGame((s) => s.clearCanvas);
  const sendGuess = useGame((s) => s.sendGuess);
  const sendReaction = useGame((s) => s.sendReaction);
  const [color, setColor] = useState("#111111");
  const [width, setWidth] = useState(0.012);
  const [tool, setTool] = useState<"brush" | "eraser">("brush");
  const me = useMemo(
    () => room.players.find((p) => p.id === profile.profileId),
    [room.players, profile.profileId]
  );
  const seconds = Math.ceil(room.timeLeftMs / 1000);

  return (
    <View style={styles.game}>
      <View style={styles.gameTop}>
        <PlayerStrip players={room.players} />
        <View style={styles.wordRow}>
          <Text style={styles.mask}>
            {isDrawer ? (myWord ?? "?") : room.wordMask}
          </Text>
          <Text style={styles.timer}>{seconds > 0 ? `${seconds}s` : ""}</Text>
        </View>
        {closeHint ? <Text style={styles.closeHint}>{closeHint}</Text> : null}
        {!isDrawer && me?.guessedCurrent ? null : (
          <View style={styles.reactionRow}>
            {["😂", "🔥", "💀", "👏"].map((e) => (
              <Pressable key={e} style={styles.reactionBtn} onPress={() => sendReaction(e)}>
                <Text style={{ fontSize: 18 }}>{e}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <DrawCanvasLazy
        isDrawer={isDrawer}
        strokes={room.strokes}
        color={color}
        width={width}
        tool={tool}
        onBatch={pushStrokeBatch}
      />

      {isDrawer ? (
        <View style={styles.toolbarWrap}>
          <Toolbar
            color={color}
            width={width}
            tool={tool}
            onChange={(v) => {
              if (v.color !== undefined) setColor(v.color);
              if (v.width !== undefined) setWidth(v.width);
              if (v.tool !== undefined) setTool(v.tool);
            }}
            onUndo={undoStroke}
            onClear={clearCanvas}
          />
        </View>
      ) : null}

      <ChatPanel
        entries={room.chat}
        isDrawer={isDrawer}
        guessedCurrent={me?.guessedCurrent ?? false}
        onSubmit={isDrawer ? sendGuess : sendGuess}
      />
    </View>
  );
}

function Stepper({
  label,
  value,
  step = 1,
  max = 10,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.stepRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.stepControls}>
        <Pressable style={styles.stepBtn} onPress={() => onChange(Math.max(1, value - step))}>
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <Text style={styles.stepValue}>{value}</Text>
        <Pressable style={styles.stepBtn} onPress={() => onChange(Math.min(max, value + step))}>
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b2545" },
  error: { color: "#ffb4b4", fontSize: 12, textAlign: "center", paddingVertical: 4 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 44,
    paddingBottom: 8,
  },
  code: { color: "#ffd700", fontWeight: "900", fontSize: 16 },
  phase: { color: "#9fc9f5", fontWeight: "700", fontSize: 13 },
  leave: { alignSelf: "center", padding: 8 },
  leaveText: { color: "#9fc9f5", fontSize: 12, fontWeight: "700" },

  // lobby
  lobby: { flex: 1 },
  lobbyContent: { paddingHorizontal: 14, paddingBottom: 16, gap: 10 },
  inviteCard: {
    backgroundColor: "#123a6b",
    borderRadius: 16,
    alignItems: "center",
    padding: 12,
    borderWidth: 2,
    borderColor: "#ffd700",
  },
  inviteLabel: { color: "#9fc9f5", fontSize: 12, fontWeight: "700" },
  inviteCode: { color: "#ffd700", fontSize: 32, fontWeight: "900", letterSpacing: 10 },
  sectionTitle: { color: "#ffffff", fontWeight: "800", fontSize: 14, marginTop: 4 },
  settingsCard: {
    backgroundColor: "#123a6b",
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  settingLabel: { color: "#dbeeff", fontWeight: "700", fontSize: 13 },
  settingHint: { color: "#9fc9f5", fontSize: 11 },
  packRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  packChip: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#ffffff18",
    borderWidth: 1,
    borderColor: "#ffffff30",
  },
  packChipOn: { backgroundColor: "#ffd700", borderColor: "#ffd700" },
  packText: { color: "#dbeeff", fontSize: 12, fontWeight: "700" },
  packTextOn: { color: "#0b2545" },
  hostNote: { color: "#9fc9f5", fontSize: 12, textAlign: "center" },
  startBtn: {
    backgroundColor: "#ffd700",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  startText: { color: "#0b2545", fontWeight: "900", fontSize: 16 },
  disabled: { opacity: 0.4 },
  stepRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stepControls: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#ffd700",
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: { color: "#0b2545", fontWeight: "900", fontSize: 18 },
  stepValue: { color: "#ffffff", fontWeight: "800", minWidth: 28, textAlign: "center" },

  // game
  game: { flex: 1, paddingHorizontal: 8, gap: 6 },
  gameTop: { gap: 4 },
  wordRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#123a6b",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mask: { color: "#ffffff", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  timer: { color: "#ffd700", fontWeight: "900", fontSize: 16 },
  closeHint: { color: "#ffd700", fontWeight: "800", fontSize: 13, textAlign: "center" },
  reactionRow: { flexDirection: "row", justifyContent: "center", gap: 8 },
  reactionBtn: {
    backgroundColor: "#ffffff18",
    borderRadius: 18,
    width: 36,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  toolbarWrap: { alignItems: "center" },
});
