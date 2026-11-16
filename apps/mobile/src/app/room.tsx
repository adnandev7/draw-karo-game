/**
 * Room screen — renders lobby or game based on the server phase.
 * Wide screens get skribbl's layout: players sidebar · canvas · chat.
 * Narrow screens stack vertically. All state comes from the store.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { availablePackIds, WORD_PACKS } from "@drawkaro/words";
import type { WordPackId } from "@drawkaro/shared";
import { t } from "../lib/strings";
import { C, F, R } from "../lib/theme";
import { useGame } from "../store/game";
import { DrawCanvasLazy } from "../components/game/DrawCanvasLazy";
import { Toolbar } from "../components/game/Toolbar";
import { ChatPanel } from "../components/game/ChatPanel";
import { PlayerList } from "../components/game/PlayerStrip";
import { GameBar } from "../components/game/GameBar";
import { GameBackdrop } from "../components/HomeBackdrop";
import {
  ChoosingOverlay,
  GameEndOverlay,
  RoundEndOverlay,
  TurnEndOverlay,
  WordChoiceOverlay,
} from "../components/game/Overlays";

const WIDE = 860;

/** Reaction chips — standard corny set, kept in sync with the server's allowlist. */
const REACTION_CHIPS = ["❤️", "😂", "😮", "😱", "🔥", "👏"] as const;

/**
 * Floating emoji over the canvas — fires on any reaction:broadcast
 * (reactions, likes and dislikes all ride the same event).
 * Remounts per reaction (keyed by ts) so each bubble animates fresh.
 */
function FloatReaction() {
  const lastReaction = useGame((s) => s.lastReaction);
  const players = useGame((s) => s.room?.players);
  if (!lastReaction) return null;
  const name = players?.find((p) => p.id === lastReaction.playerId)?.name ?? "?";
  return <FloatBubble key={lastReaction.ts} emoji={lastReaction.emoji} name={name} />;
}

function FloatBubble({ emoji, name }: { emoji: string; name: string }) {
  const val = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    const anim = Animated.timing(val, {
      toValue: 1,
      duration: 1_800,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [val]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.floatReaction,
        {
          opacity: val.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateY: val.interpolate({ inputRange: [0, 1], outputRange: [0, -70] }) },
            { scale: val.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.6, 1.15, 1] }) },
          ],
        },
      ]}
    >
      <Text style={styles.floatEmoji}>{emoji}</Text>
      <Text style={styles.floatName}>{name}</Text>
    </Animated.View>
  );
}

export default function RoomScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const room = useGame((s) => s.room);
  const profile = useGame((s) => s.profile);
  const errorMsg = useGame((s) => s.errorMsg);
  const myWordOptions = useGame((s) => s.myWordOptions);
  const turnEnd = useGame((s) => s.turnEnd);
  const roundEnd = useGame((s) => s.roundEnd);
  const gameEnd = useGame((s) => s.gameEnd);

  useEffect(() => {
    if (!room) router.replace("/");
  }, [room, router]);

  const wide = width >= WIDE;
  // clamp column widths to the viewport so nothing can overflow
  const sideW = Math.min(280, Math.max(190, Math.round(width * 0.21)));
  const chatW = Math.min(340, Math.max(230, Math.round(width * 0.25)));

  if (!room) return null;

  const isHost = room.players.find((p) => p.id === profile.profileId)?.isHost ?? false;
  const isDrawer = room.drawerId === profile.profileId;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <GameBackdrop />
      {room.phase === "lobby" ? (
        <LobbyView isHost={isHost} wide={wide} sideW={sideW} chatW={chatW} />
      ) : (
        <GameView isDrawer={isDrawer} wide={wide} sideW={sideW} chatW={chatW} />
      )}

      {/* overlays */}
      {room.phase === "selecting" && isDrawer && myWordOptions ? (
        <WordChoiceOverlay words={myWordOptions} seconds={Math.ceil(room.timeLeftMs / 1000)} />
      ) : null}
      {room.phase === "selecting" && !isDrawer && room.drawerId ? (
        <ChoosingOverlay
          name={room.players.find((p) => p.id === room.drawerId)?.name ?? "?"}
          avatar={room.players.find((p) => p.id === room.drawerId)?.avatar ?? null}
        />
      ) : null}
      {room.phase === "turnEnd" && turnEnd ? (
        <TurnEndOverlay word={turnEnd.word} drawerId={turnEnd.drawerId} results={turnEnd.results} />
      ) : null}
      {room.phase === "roundEnd" && roundEnd ? (
        <RoundEndOverlay round={roundEnd.round} leaderboard={roundEnd.leaderboard} />
      ) : null}
      {room.phase === "gameEnd" && gameEnd ? <GameEndOverlay podium={gameEnd.podium} /> : null}

      {errorMsg ? (
        <View style={styles.errorToast}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

// ─── Lobby ────────────────────────────────────────────────────────────────────

function LobbyView({
  isHost,
  wide,
  sideW,
  chatW,
}: {
  isHost: boolean;
  wide: boolean;
  sideW: number;
  chatW: number;
}) {
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

  const main = (
    <ScrollView
      style={styles.lobbyScroll}
      contentContainerStyle={styles.lobbyContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.inviteCard}>
        <Text style={styles.inviteLabel}>{t.inviteLabel}</Text>
        <Text style={styles.inviteCode}>#{room.code}</Text>
      </View>

      {isHost ? (
        <>
          <Text style={styles.sectionTitle}>{t.settingsHostOnly}</Text>
          <View style={styles.settingsCard}>
            <Stepper
              label={t.rounds}
              value={room.settings.rounds}
              max={10}
              onChange={(v) => updateSettings({ rounds: v })}
            />
            <Stepper
              label={t.drawTime}
              value={room.settings.drawTimeSec}
              step={10}
              max={180}
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
              {availablePackIds().map((id) => {
                const on = room.settings.packs.includes(id);
                return (
                  <Pressable
                    key={id}
                    style={[styles.packChip, on && styles.packChipOn]}
                    onPress={() => togglePack(id)}
                  >
                    <Text style={[styles.packText, on && styles.packTextOn]}>
                      {WORD_PACKS[id]?.emoji} {WORD_PACKS[id]?.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.settingHint}>{t.insideJokeHint}</Text>
          </View>
          <Pressable
            style={[styles.startBtn, !canStart && styles.disabled]}
            disabled={!canStart}
            onPress={startGame}
          >
            <Text style={styles.startText}>
              {!canStart ? t.needPlayers : "Start Game! 🚀"}
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.hostNote}>
            {t.hostControls(room.players.find((p) => p.isHost)?.name ?? "?")}
          </Text>
          <Pressable style={[styles.startBtn, styles.disabled]} disabled>
            <Text style={styles.startText}>{t.waitingForHost}</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );

  const side = (
    <View style={[styles.lobbySide, { width: Math.min(440, sideW + chatW) }]}>
      <Text style={styles.sectionTitle}>
        {t.players} ({room.players.length}/{room.settings.maxPlayers})
      </Text>
      <PlayerList players={room.players} drawerId={null} layout="rows" />
      <View style={styles.lobbySideChat}>
        <ChatPanel
          entries={room.chat}
          isDrawer={false}
          guessedCurrent={false}
          onSubmit={sendChat}
        />
      </View>
    </View>
  );

  if (wide) {
    return (
      <View style={styles.wideRow}>
        <View style={[styles.wideMain, { maxWidth: 620 }]}>{main}</View>
        {side}
        <LeaveButton />
      </View>
    );
  }

  return (
    <ScrollView style={styles.lobby} contentContainerStyle={styles.lobbyContentNarrow}>
      <View style={styles.inviteCard}>
        <Text style={styles.inviteLabel}>{t.inviteLabel}</Text>
        <Text style={styles.inviteCode}>#{room.code}</Text>
      </View>
      <Text style={styles.sectionTitle}>
        {t.players} ({room.players.length}/{room.settings.maxPlayers})
      </Text>
      <PlayerList players={room.players} drawerId={null} layout="strip" />
      {isHost ? (
        <>
          <Text style={styles.sectionTitle}>{t.settingsHostOnly}</Text>
          <View style={styles.settingsCard}>
            <Stepper
              label={t.rounds}
              value={room.settings.rounds}
              max={10}
              onChange={(v) => updateSettings({ rounds: v })}
            />
            <Stepper
              label={t.drawTime}
              value={room.settings.drawTimeSec}
              step={10}
              max={180}
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
              {availablePackIds().map((id) => {
                const on = room.settings.packs.includes(id);
                return (
                  <Pressable
                    key={id}
                    style={[styles.packChip, on && styles.packChipOn]}
                    onPress={() => togglePack(id)}
                  >
                    <Text style={[styles.packText, on && styles.packTextOn]}>
                      {WORD_PACKS[id]?.emoji} {WORD_PACKS[id]?.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.settingHint}>{t.insideJokeHint}</Text>
          </View>
          <Pressable
            style={[styles.startBtn, !canStart && styles.disabled]}
            disabled={!canStart}
            onPress={startGame}
          >
            <Text style={styles.startText}>
              {!canStart ? t.needPlayers : "Start Game! 🚀"}
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.hostNote}>
            {t.hostControls(room.players.find((p) => p.isHost)?.name ?? "?")}
          </Text>
          <Pressable style={[styles.startBtn, styles.disabled]} disabled>
            <Text style={styles.startText}>{t.waitingForHost}</Text>
          </Pressable>
        </>
      )}
      <ChatPanel entries={room.chat} isDrawer={false} guessedCurrent={false} onSubmit={sendChat} />
      <LeaveButton />
    </ScrollView>
  );
}

// ─── Game ─────────────────────────────────────────────────────────────────────

function GameView({
  isDrawer,
  wide,
  sideW,
  chatW,
}: {
  isDrawer: boolean;
  wide: boolean;
  sideW: number;
  chatW: number;
}) {
  const room = useGame((s) => s.room)!;
  const profile = useGame((s) => s.profile);
  const myWord = useGame((s) => s.myWord);
  const closeHint = useGame((s) => s.closeHint);
  const pushStrokeBatch = useGame((s) => s.pushStrokeBatch);
  const undoStroke = useGame((s) => s.undoStroke);
  const clearCanvas = useGame((s) => s.clearCanvas);
  const sendGuess = useGame((s) => s.sendGuess);
  const sendReaction = useGame((s) => s.sendReaction);
  const rateDrawing = useGame((s) => s.rateDrawing);
  const [color, setColor] = useState("#111111");
  const [width, setWidth] = useState(0.014);
  const [tool, setTool] = useState<"brush" | "eraser">("brush");
  const me = useMemo(
    () => room.players.find((p) => p.id === profile.profileId),
    [room.players, profile.profileId]
  );
  const seconds = Math.ceil(room.timeLeftMs / 1000);
  const waiting = room.phase === "turnEnd" || room.phase === "roundEnd";

  const gameBar = (
    <GameBar
      round={room.round}
      total={room.settings.rounds}
      seconds={seconds}
      isDrawer={isDrawer}
      myWord={myWord}
      mask={room.wordMask}
      waiting={waiting}
    />
  );

  const playersBlock = (
    <PlayerList players={room.players} drawerId={room.drawerId} layout={wide ? "rows" : "strip"} />
  );

  // skribbl: every non-drawer can react while the drawing is live —
  // guessed players included
  const reactionChips = !isDrawer && room.phase === "drawing" ? (
    <View style={styles.reactionRow}>
      {REACTION_CHIPS.map((e) => (
        <Pressable key={e} style={styles.reactionBtn} onPress={() => sendReaction(e)}>
          <Text style={{ fontSize: 18 }}>{e}</Text>
        </Pressable>
      ))}
    </View>
  ) : null;

  const canvasBlock = (
    <View style={styles.canvasBlock}>
      {closeHint ? (
        <View style={styles.closeHint}>
          <Text style={styles.closeHintText}>{closeHint}</Text>
        </View>
      ) : null}
      <View style={styles.canvasCard}>
        <DrawCanvasLazy
          isDrawer={isDrawer}
          strokes={room.strokes}
          color={color}
          width={width}
          tool={tool}
          onBatch={pushStrokeBatch}
        />
        {/* skribbl's thumbs over the canvas — guessers rate the drawing */}
        {!isDrawer && (room.phase === "drawing" || room.phase === "turnEnd") ? (
          <View style={styles.rateRow} pointerEvents="box-none">
            <Pressable
              style={styles.rateBtn}
              accessibilityLabel={t.likeDrawing}
              onPress={() => rateDrawing("like")}
            >
              <Text style={styles.rateEmoji}>👍</Text>
            </Pressable>
            <Pressable
              style={styles.rateBtn}
              accessibilityLabel={t.dislikeDrawing}
              onPress={() => rateDrawing("dislike")}
            >
              <Text style={styles.rateEmoji}>👎</Text>
            </Pressable>
          </View>
        ) : null}
        <FloatReaction />
      </View>
      {isDrawer ? (
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
      ) : null}
      {reactionChips}
    </View>
  );

  if (wide) {
    return (
      <View style={styles.gameWide}>
        {gameBar}
        <View style={styles.gameWideRow}>
          <View style={[styles.gameSide, { width: sideW }]}>{playersBlock}</View>
          <View style={styles.gameCenter}>{canvasBlock}</View>
          <View style={[styles.gameChatSide, { width: chatW }]}>
            <ChatPanel
              entries={room.chat}
              isDrawer={isDrawer}
              guessedCurrent={me?.guessedCurrent ?? false}
              onSubmit={sendGuess}
            />
          </View>
        </View>
        <LeaveButton floating />
      </View>
    );
  }

  return (
    <View style={styles.gameNarrow}>
      {gameBar}
      {playersBlock}
      {canvasBlock}
      <View style={styles.narrowChat}>
        <ChatPanel
          entries={room.chat}
          isDrawer={isDrawer}
          guessedCurrent={me?.guessedCurrent ?? false}
          onSubmit={sendGuess}
        />
      </View>
      <LeaveButton floating />
    </View>
  );
}

function LeaveButton({ floating }: { floating?: boolean }) {
  const leaveRoom = useGame((s) => s.leaveRoom);
  const btn = (
    <Pressable style={styles.leave} onPress={leaveRoom}>
      <Text style={styles.leaveText}>🚪 Leave</Text>
    </Pressable>
  );
  if (!floating) return btn;
  // box-none wrapper: the full-width strip must not eat clicks aimed at
  // the reaction chips / chat that sit underneath it
  return (
    <View style={styles.leaveFloating} pointerEvents="box-none">
      {btn}
    </View>
  );
}

// ─── Shared bits ──────────────────────────────────────────────────────────────

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
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // wide layout
  wideRow: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    padding: 8,
    justifyContent: "center",
  },
  wideMain: { flex: 1 },
  lobbySide: { flexShrink: 0, gap: 6 },
  lobbySideChat: { flex: 1 },

  // narrow layout
  lobby: { flex: 1 },
  lobbyScroll: { flex: 1 },
  lobbyContent: { padding: 12, gap: 10, paddingBottom: 20 },
  lobbyContentNarrow: { padding: 12, gap: 10, paddingBottom: 20 },

  // lobby pieces
  inviteCard: {
    backgroundColor: C.panel,
    borderRadius: R.m,
    borderWidth: 1,
    borderColor: C.panelBorder,
    alignItems: "center",
    padding: 12,
  },
  inviteLabel: { color: C.panelDim, fontSize: 11, fontFamily: F.bold },
  inviteCode: {
    color: "#ffffff",
    fontSize: 34,
    fontFamily: F.black,
    letterSpacing: 8,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  sectionTitle: {
    color: "#ffffff",
    fontFamily: F.xbold,
    fontSize: 13,
    opacity: 0.9,
  },
  settingsCard: {
    backgroundColor: C.panel,
    borderRadius: R.m,
    borderWidth: 1,
    borderColor: C.panelBorder,
    padding: 12,
    gap: 10,
  },
  settingLabel: { color: C.panelText, fontFamily: F.bold, fontSize: 13 },
  settingHint: { color: C.panelDim, fontSize: 11, fontFamily: F.regular },
  packRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  packChip: {
    borderRadius: R.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderWidth: 1,
    borderColor: C.panelBorder,
  },
  packChipOn: { backgroundColor: C.green, borderColor: "#2c8a17" },
  packText: { color: C.panelText, fontSize: 12, fontFamily: F.bold },
  packTextOn: { color: "#0b3a10" },
  hostNote: { color: C.panelDim, fontSize: 12, fontFamily: F.regular, textAlign: "center" },
  startBtn: {
    backgroundColor: C.green,
    borderRadius: R.pill,
    paddingVertical: 13,
    alignItems: "center",
  },
  startText: { color: "#ffffff", fontFamily: F.black, fontSize: 16 },
  disabled: { opacity: 0.45 },
  stepRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stepControls: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderWidth: 1,
    borderColor: C.panelBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: { color: "#ffffff", fontFamily: F.black, fontSize: 18 },
  stepValue: {
    color: "#ffffff",
    fontFamily: F.xbold,
    minWidth: 28,
    textAlign: "center",
  },

  // game layout
  gameWide: { flex: 1, padding: 8, gap: 8 },
  gameWideRow: { flex: 1, flexDirection: "row", gap: 8 },
  gameSide: { flexShrink: 0 },
  gameCenter: { flex: 1, gap: 6, minWidth: 260 },
  gameChatSide: { flexShrink: 0 },
  gameNarrow: { flex: 1, padding: 8, gap: 6 },

  canvasBlock: { flex: 1, gap: 6 },
  canvasCard: {
    flex: 1,
    backgroundColor: C.canvas,
    borderRadius: R.m,
    overflow: "hidden",
  },
  closeHint: {
    alignSelf: "center",
    backgroundColor: "rgba(226, 203, 0, 0.95)",
    borderRadius: R.pill,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  closeHintText: { color: "#111111", fontFamily: F.xbold, fontSize: 12 },
  reactionRow: { flexDirection: "row", justifyContent: "center", gap: 8 },
  reactionBtn: {
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.panelBorder,
    borderRadius: R.pill,
    width: 40,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  // like / dislike thumbs over the canvas (skribbl)
  rateRow: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    gap: 6,
  },
  rateBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: C.canvasInk,
    alignItems: "center",
    justifyContent: "center",
  },
  rateEmoji: { fontSize: 17 },
  // floating reaction bubble
  floatReaction: {
    position: "absolute",
    top: 14,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  floatEmoji: { fontSize: 34 },
  floatName: {
    color: "#ffffff",
    fontFamily: F.xbold,
    fontSize: 11,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  narrowChat: { flex: 1, minHeight: 140, marginBottom: 30 },

  leave: { alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 12 },
  leaveFloating: {
    position: "absolute",
    bottom: 6,
    left: 8,
    alignItems: "flex-start",
  },
  leaveText: { color: "#ffffff", fontSize: 12, fontFamily: F.bold, opacity: 0.8 },

  errorToast: {
    position: "absolute",
    bottom: 60,
    left: 20,
    right: 20,
    backgroundColor: "rgba(211, 7, 7, 0.9)",
    borderRadius: R.m,
    padding: 10,
  },
  errorText: { color: "#ffffff", fontFamily: F.bold, fontSize: 12, textAlign: "center" },
});
