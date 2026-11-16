/**
 * Draw Karo — authoritative room & game state machine (M1).
 *
 * The server is the ONLY source of truth: word, timer, scores, turn order,
 * guess validity. Clients render state; they never decide it.
 */
import type { Server, Socket } from "socket.io";
import {
  DEFAULT_ROOM_SETTINGS,
  drawerPoints,
  guesserPoints,
  isGuessClose,
  isGuessCorrect,
  type AvatarDescriptor,
  type ChatEntry,
  type ClientToServerEvents,
  type GamePhase,
  type LeaderboardEntry,
  type Player,
  type RoomOpResult,
  type RoomSettings,
  type RoomState,
  type ServerToClientEvents,
  type Stroke,
  type TurnEndPayload,
  type TurnResultEntry,
  type WordPackId,
} from "@drawkaro/shared";
import { availablePackIds, collectRoomWords, type WordEntry } from "@drawkaro/words";

// ─── Socket types ────────────────────────────────────────────────────────────

export type SocketData = { profileId?: string; roomCode?: string };
export type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<never, never>, SocketData>;
export type GameServer = Server<ClientToServerEvents, ServerToClientEvents, Record<never, never>, SocketData>;

export type Profile = { profileId: string; name: string; avatar: AvatarDescriptor };

type RoomPlayer = Player & {
  lastGuessTimes: number[];
  turnPoints: number;
  disconnectTimer: NodeJS.Timeout | null;
};

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** Standard corny set shown as reaction chips in the UI — keep in sync. */
const REACTION_EMOJIS = new Set(["❤️", "😂", "😮", "😱", "🔥", "👏"]);
const GUESS_WINDOW_MS = 5_000;
const GUESS_MAX_PER_WINDOW = 6;
const SELECT_TIME_MS = 15_000;
const TURN_END_MS = 6_000;
const ROUND_END_MS = 8_000;
const GAME_END_MS = 20_000;
/** Generous reconnect window — mobile browsers/app switchers can freeze a tab
 * for minutes; skribbl's "backgrounded = kicked" annoyance must not happen. */
const DISCONNECT_GRACE_MS = 3 * 60_000;
/** Hint reveal starts when this fraction of draw time remains (skribbl-style). */
const HINT_FRACTIONS = [0.6, 0.35, 0.15];

function randomCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

function now(): number {
  return Date.now();
}

export class Room {
  readonly code: string;
  readonly io: GameServer;
  players = new Map<string, RoomPlayer>(); // keyed by profileId
  settings: RoomSettings = { ...DEFAULT_ROOM_SETTINGS };
  phase: GamePhase = "lobby";
  round = 0;
  turn = 0;
  drawerId: string | null = null;
  wordOptions: WordEntry[] = [];
  word: WordEntry | null = null;
  wordMask = "";
  hintsRevealed = 0;
  strokes: Stroke[] = [];
  chat: ChatEntry[] = [];
  /** ms timestamp when the current timed phase ends; 0 = not timed. */
  phaseEndsAt = 0;
  private timers: NodeJS.Timeout[] = [];
  private hintMarks: number[] = [];
  private hintMarkIndex = 0;
  private guessCount = 0;
  private lastReactionAt = new Map<string, number>();
  private lastRateAt = new Map<string, number>();
  private usedWords = new Set<string>();
  private emptySince: number | null = null;
  onEmpty: (code: string) => void = () => {};

  constructor(code: string, io: Room["io"]) {
    this.code = code;
    this.io = io;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private get channel(): string {
    return `room:${this.code}`;
  }

  private toAll<K extends keyof ServerToClientEvents>(
    event: K,
    ...args: Parameters<ServerToClientEvents[K]>
  ): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.io.to(this.channel) as any).emit(event, ...args);
  }

  private later(delayMs: number, fn: () => void): void {
    this.timers.push(setTimeout(fn, delayMs));
  }

  private clearTimers(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    this.hintMarks = [];
    this.hintMarkIndex = 0;
  }

  private systemMsg(text: string): void {
    this.chat.push({
      id: `sys-${now()}-${Math.random().toString(36).slice(2, 6)}`,
      playerId: "system",
      playerName: "",
      text,
      kind: "system",
      ts: Date.now(),
    });
    this.trimChat();
  }

  private trimChat(): void {
    if (this.chat.length > 100) this.chat = this.chat.slice(-100);
  }

  private wordPool(): WordEntry[] {
    return collectRoomWords({
      packs: this.settings.packs,
      customWords: this.settings.customWords,
      onlyCustom: this.settings.onlyCustom,
    });
  }

  private maskFor(word: string): string {
    // letters → "_", everything else (spaces, hyphens) shown as-is
    return word.replace(/[a-zA-Z0-9]/g, "_");
  }

  private state(): RoomState {
    return {
      code: this.code,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        score: p.score,
        isHost: p.isHost,
        connected: p.connected,
        guessedCurrent: p.guessedCurrent,
      })),
      settings: this.settings,
      phase: this.phase,
      drawerId: this.drawerId,
      wordMask: this.wordMask,
      timeLeftMs: this.phaseEndsAt ? Math.max(0, this.phaseEndsAt - now()) : 0,
      round: this.round,
      turn: this.turn,
      strokes: this.strokes,
      chat: this.chat,
    };
  }

  broadcastState(): void {
    this.toAll("room:state", this.state());
  }

  // ─── Join / leave ──────────────────────────────────────────────────────────

  join(socket: GameSocket, profile: Profile, asHost: boolean): RoomOpResult {
    if (this.players.size >= this.settings.maxPlayers) return { ok: false, error: "Room is full" };
    if (this.phase !== "lobby" && !this.players.has(profile.profileId)) {
      return { ok: false, error: "Game already in progress — ask the host to wait" };
    }

    const existing = this.players.get(profile.profileId);
    if (existing) {
      // Reconnect: reattach socket, restore connection
      if (existing.disconnectTimer) clearTimeout(existing.disconnectTimer);
      existing.disconnectTimer = null;
      existing.name = profile.name;
      existing.avatar = profile.avatar;
      existing.connected = true;
      socket.data.profileId = profile.profileId;
      socket.data.roomCode = this.code;
      socket.join(this.channel);
      this.sockets.set(profile.profileId, socket);
      this.systemMsg(`${profile.name} is back!`);
      // The drawer missed the one-shot word/options event while away —
      // hand them over again so a backgrounded drawer can keep drawing.
      if (this.drawerId === profile.profileId) {
        if (this.phase === "selecting" && this.wordOptions.length > 0) {
          socket.emit("turn:selecting", {
            drawerId: profile.profileId,
            wordMask: "",
            words: this.wordOptions.map((w) => w.word),
          });
        } else if (this.phase === "drawing" && this.word) {
          socket.emit("turn:drawing", {
            drawerId: profile.profileId,
            wordLength: this.word.word.length,
            word: this.word.word,
          });
        }
      }
      this.broadcastState();
      return { ok: true, roomState: this.state() };
    }

    const player: RoomPlayer = {
      id: profile.profileId,
      name: profile.name,
      avatar: profile.avatar,
      score: 0,
      isHost: asHost,
      connected: true,
      guessedCurrent: false,
      lastGuessTimes: [],
      turnPoints: 0,
      disconnectTimer: null,
    };
    // First player (re)joins → becomes host
    if (this.players.size === 0) player.isHost = true;
    this.players.set(profile.profileId, player);
    socket.data.profileId = profile.profileId;
    socket.data.roomCode = this.code;
    socket.join(this.channel);
    this.sockets.set(profile.profileId, socket);
    this.emptySince = null;
    this.systemMsg(`${profile.name} joined the room`);
    this.toAll("player:joined", {
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      score: player.score,
      isHost: player.isHost,
      connected: true,
      guessedCurrent: false,
    });
    this.broadcastState();
    return { ok: true, roomState: this.state() };
  }

  private sockets = new Map<string, GameSocket>(); // profileId → current socket

  /** Player clicked "leave" or socket dropped. `graceful` = explicit leave. */
  playerDisconnected(profileId: string, graceful: boolean): void {
    const player = this.players.get(profileId);
    if (!player) return;
    this.sockets.delete(profileId);
    player.connected = false;

    if (graceful) {
      this.finalizeRemoval(profileId);
      return;
    }
    // Reconnect grace window
    if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
    player.disconnectTimer = setTimeout(() => {
      const p = this.players.get(profileId);
      if (p && !p.connected) this.finalizeRemoval(profileId);
    }, DISCONNECT_GRACE_MS);
    this.systemMsg(`${player.name} lost connection — they can still reconnect`);
    this.broadcastState();
  }

  private finalizeRemoval(profileId: string): void {
    const player = this.players.get(profileId);
    if (!player) return;
    this.players.delete(profileId);
    if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
    this.toAll("player:left", profileId);
    this.systemMsg(`${player.name} left the room`);

    if (this.players.size === 0) {
      this.clearTimers();
      this.emptySince = now(); // manager sweeps after a short while
      return;
    }

    // Host transfer
    if (player.isHost) {
      const nextHost = [...this.players.values()][0];
      nextHost.isHost = true;
      this.systemMsg(`${nextHost.name} is the new host 👑`);
    }

    // Mid-game drawer left → advance the turn safely
    if (this.drawerId === profileId) {
      if (this.phase === "selecting") {
        this.clearTimers();
        this.nextTurn();
      } else if (this.phase === "drawing") {
        this.endTurn();
      }
    }

    if (this.players.size < 2 && this.phase !== "lobby") {
      this.clearTimers();
      this.phase = "lobby";
      this.round = 0;
      this.turn = 0;
      this.drawerId = null;
      this.systemMsg("Not enough players — back to the lobby. Invite some friends!");
    }
    this.broadcastState();
  }

  // ─── Settings ──────────────────────────────────────────────────────────────

  updateSettings(patch: Partial<RoomSettings>): void {
    if (this.phase !== "lobby") return;
    this.settings = {
      ...this.settings,
      ...patch,
      rounds: clamp(patch.rounds ?? this.settings.rounds, 1, 10),
      drawTimeSec: clamp(patch.drawTimeSec ?? this.settings.drawTimeSec, 30, 180),
      maxPlayers: clamp(patch.maxPlayers ?? this.settings.maxPlayers, 2, 16),
      wordChoices: clamp(patch.wordChoices ?? this.settings.wordChoices, 2, 4),
      hints: clamp(patch.hints ?? this.settings.hints, 0, 3),
      packs: (patch.packs ?? this.settings.packs).filter((p) =>
        availablePackIds().includes(p as WordPackId)
      ),
      customWords: (patch.customWords ?? this.settings.customWords).slice(0, 200),
    };
    this.broadcastState();
  }

  // ─── Game flow ─────────────────────────────────────────────────────────────

  startGame(): { ok: boolean; error?: string } {
    if (this.phase !== "lobby") return { ok: false, error: "Game already started" };
    if (this.players.size < 2) return { ok: false, error: "You need at least 2 players!" };

    if (this.wordPool().length === 0) {
      return { ok: false, error: "No words available — add word packs or custom words" };
    }
    for (const p of this.players.values()) {
      p.score = 0;
      p.turnPoints = 0;
    }
    this.usedWords = new Set();
    this.round = 1;
    this.turn = 0;
    this.toAll("game:started", this.round);
    this.nextTurn();
    return { ok: true };
  }

  private nextTurn(): void {
    const order = [...this.players.keys()];
    if (order.length < 2) return this.backToLobby("Not enough players — game cancelled!");
    this.turn++;
    if (this.turn > order.length) return this.endRound();

    const drawerId = order[this.turn - 1];
    const drawer = this.players.get(drawerId);
    if (!drawer || !drawer.connected) {
      // skip disconnected drawers
      return this.nextTurn();
    }

    this.drawerId = drawerId;
    this.phase = "selecting";
    this.word = null;
    this.wordMask = "";
    this.phaseEndsAt = now() + SELECT_TIME_MS;
    const options = this.pickWords(this.settings.wordChoices);
    this.wordOptions = options;
    this.toAll("turn:selecting", {
      drawerId,
      wordMask: "",
    });
    // drawer gets the actual options privately
    const drawerSocket = this.sockets.get(drawerId);
    if (drawerSocket) {
      drawerSocket.emit("turn:selecting", {
        drawerId,
        wordMask: "",
        words: options.map((o) => o.word),
      });
    }
    this.broadcastState();

    this.clearTimers();
    this.later(SELECT_TIME_MS, () => {
      if (this.phase !== "selecting") return;
      const random = options[Math.floor(Math.random() * options.length)];
      this.startDrawing(random);
    });
    // per-second tick so every client's word-choice countdown stays live
    const ticker = setInterval(() => {
      if (this.phase !== "selecting") return;
      this.broadcastState();
    }, 1_000);
    this.timers.push(ticker as unknown as NodeJS.Timeout);
  }

  private pickWords(count: number): WordEntry[] {
    // avoid repeating words within the same game
    const fresh = this.wordPool().filter((w) => !this.usedWords.has(w.word.toLowerCase()));
    const pool = fresh.length >= count ? fresh : [...fresh, ...this.wordPool()];
    // skribbl-style pacing: early rounds favor easy words, the last rounds
    // spice things up with harder vocabulary. Weighted sampling w/o replacement.
    const totalRounds = Math.max(1, this.settings.rounds);
    const progress =
      totalRounds <= 1 ? 0 : Math.min(1, Math.max(0, (this.round - 1) / (totalRounds - 1)));
    const weightOf = (e: WordEntry): number => {
      if (e.difficulty === "easy") return 2.0 - 1.0 * progress; // 2 → 1
      if (e.difficulty === "medium") return 1.5;
      return 0.6 + 0.9 * progress; // 0.6 → 1.5
    };
    const picked: WordEntry[] = [];
    while (picked.length < count && pool.length > 0) {
      const weights = pool.map(weightOf);
      const total = weights.reduce((a, b) => a + b, 0);
      let roll = Math.random() * total;
      let idx = pool.length - 1;
      for (let i = 0; i < pool.length; i++) {
        roll -= weights[i];
        if (roll <= 0) {
          idx = i;
          break;
        }
      }
      const [entry] = pool.splice(idx, 1);
      this.usedWords.add(entry.word.toLowerCase());
      picked.push(entry);
    }
    return picked;
  }

  chooseWord(index: number): void {
    if (this.phase !== "selecting") return;
    const chosen = this.wordOptions[clamp(index, 0, this.wordOptions.length - 1)];
    if (!chosen) return;
    this.startDrawing(chosen);
  }

  private startDrawing(entry: WordEntry): void {
    this.word = entry;
    this.wordMask = this.maskFor(entry.word);
    this.hintsRevealed = 0;
    this.hintMarkIndex = 0;
    this.guessCount = 0;
    this.strokes = [];
    for (const p of this.players.values()) {
      p.guessedCurrent = false;
      p.turnPoints = 0;
    }
    this.phase = "drawing";
    const totalMs = this.settings.drawTimeSec * 1000;
    this.phaseEndsAt = now() + totalMs;

    // everyone gets the turn header; the drawer also gets the word
    this.toAll("turn:drawing", { drawerId: this.drawerId!, wordLength: entry.word.length });
    const drawerSocket = this.drawerId ? this.sockets.get(this.drawerId) : undefined;
    if (drawerSocket) {
      drawerSocket.emit("turn:drawing", {
        drawerId: this.drawerId!,
        wordLength: entry.word.length,
        word: entry.word,
      });
    }
    this.broadcastState();

    this.clearTimers();
    this.hintMarks = HINT_FRACTIONS.slice(0, this.settings.hints).map(
      (f) => this.phaseEndsAt - totalMs * f
    );
    const ticker = setInterval(() => this.drawingTick(), 1_000);
    this.timers.push(ticker as unknown as NodeJS.Timeout);
    this.drawingTick();
  }

  private drawingTick(): void {
    if (this.phase !== "drawing") return;
    const remaining = Math.max(0, this.phaseEndsAt - now());

    // reveal scheduled hints
    if (
      this.hintMarkIndex < this.hintMarks.length &&
      now() >= this.hintMarks[this.hintMarkIndex] &&
      this.word
    ) {
      this.hintMarkIndex++;
      this.revealHintLetter();
    }

    this.broadcastState(); // carries timeLeftMs for the timer UI
    if (remaining <= 0) this.endTurn();
  }

  private revealHintLetter(): void {
    if (!this.word) return;
    const chars = [...this.wordMask];
    const letterIdxs: number[] = [];
    const wordChars = [...this.word.word];
    for (let i = 0; i < chars.length; i++) {
      if (chars[i] === "_" && /[a-zA-Z0-9]/.test(wordChars[i] ?? "")) letterIdxs.push(i);
    }
    if (letterIdxs.length === 0) return;
    const pick = letterIdxs[Math.floor(Math.random() * letterIdxs.length)];
    chars[pick] = wordChars[pick].toLowerCase();
    this.wordMask = chars.join("");
    this.hintsRevealed++;
    this.toAll("hint:reveal", this.wordMask);
  }

  // ─── Drawing ───────────────────────────────────────────────────────────────

  addStrokeBatch(
    senderId: string,
    delta: { strokeId: string; color: string; width: number; tool: Stroke["tool"]; points: Array<{ x: number; y: number }> }
  ): void {
    if (this.phase !== "drawing" || this.drawerId !== senderId) return;
    if (!delta.points || delta.points.length === 0) return;
    if (this.strokes.length > 400) return; // safety cap
    // batches of the same gesture append to one continuous stroke so
    // snapshots (late joins) render smooth lines, not dashes
    const last = this.strokes[this.strokes.length - 1];
    if (last && last.id === delta.strokeId) {
      last.points.push(...delta.points);
    } else {
      this.strokes.push({
        id: delta.strokeId,
        color: delta.color,
        width: delta.width,
        tool: delta.tool,
        points: delta.points,
      });
    }
    this.toAll("draw:stroke", delta);
  }

  undoStroke(senderId: string): void {
    if (this.phase !== "drawing" || this.drawerId !== senderId) return;
    const last = this.strokes[this.strokes.length - 1];
    if (!last) return;
    this.strokes = this.strokes.filter((s) => s.id !== last.id);
    this.toAll("draw:undo", last.id);
  }

  clearStrokes(senderId: string): void {
    if (this.phase !== "drawing" || this.drawerId !== senderId) return;
    this.strokes = [];
    this.toAll("draw:clear");
  }

  // ─── Guessing & chat ───────────────────────────────────────────────────────

  submitGuess(senderId: string, raw: string): void {
    const player = this.players.get(senderId);
    if (!player || !player.connected) return;
    const text = raw.trim().slice(0, 80);
    if (!text) return;

    if (this.phase === "drawing") {
      if (senderId === this.drawerId || player.guessedCurrent) {
        // drawer chat during their turn: treat as chat message
        this.pushChat(senderId, text, "chat");
        return;
      }
      // rate limit
      const t = now();
      player.lastGuessTimes = player.lastGuessTimes.filter((x) => t - x < GUESS_WINDOW_MS);
      if (player.lastGuessTimes.length >= GUESS_MAX_PER_WINDOW) return;
      player.lastGuessTimes.push(t);

      if (this.word && isGuessCorrect(text, this.word.word, this.word.accepted)) {
        const socket = this.sockets.get(senderId);
        const points = guesserPoints({
          timeRemainingMs: this.phaseEndsAt - now(),
          totalTimeMs: this.settings.drawTimeSec * 1000,
          hintsRevealed: this.hintsRevealed,
        });
        this.guessCount++;
        player.score += points;
        player.turnPoints += points;
        player.guessedCurrent = true;
        this.chat.push({
          id: `c-${now()}-${Math.random().toString(36).slice(2, 6)}`,
          playerId: senderId,
          playerName: player.name,
          text: "guessed the word! 🎉",
          kind: "correct",
          ts: Date.now(),
        });
        this.trimChat();
        this.toAll("guess:correct", { playerId: senderId, points, guessOrder: this.guessCount });
        if (this.allGuessed()) this.endTurn();
      } else if (this.word && isGuessClose(text, this.word.word)) {
        const socket = this.sockets.get(senderId);
        socket?.emit("guess:close", "So close! Keep guessing 🔍");
        this.pushChat(senderId, text, "chat");
      } else {
        this.pushChat(senderId, text, "chat");
        this.sockets.get(senderId)?.emit("guess:wrong");
      }
      return;
    }

    // outside drawing: plain chat
    this.pushChat(senderId, text, "chat");
  }

  private allGuessed(): boolean {
    for (const [id, p] of this.players) {
      if (id !== this.drawerId && !p.guessedCurrent) return false;
    }
    return true;
  }

  chatMessage(senderId: string, raw: string): void {
    const player = this.players.get(senderId);
    if (!player || !player.connected) return;
    this.pushChat(senderId, raw.trim().slice(0, 200), "chat");
  }

  private pushChat(playerId: string, text: string, kind: ChatEntry["kind"]): void {
    if (!text) return;
    const player = this.players.get(playerId);
    const entry: ChatEntry = {
      id: `c-${now()}-${Math.random().toString(36).slice(2, 6)}`,
      playerId,
      playerName: player?.name ?? "?",
      text,
      kind,
      ts: Date.now(),
    };
    this.chat.push(entry);
    this.trimChat();
    this.toAll("chat:entry", entry);
  }

  // ─── Reactions ─────────────────────────────────────────────────────────────

  sendReaction(senderId: string, emoji: string): void {
    if (!REACTION_EMOJIS.has(emoji)) return;
    const player = this.players.get(senderId);
    if (!player || !player.connected) return;
    const last = this.lastReactionAt.get(senderId) ?? 0;
    if (now() - last < 2_000) return;
    this.lastReactionAt.set(senderId, now());
    // skribbl-style: reactions land in the chat too — "X reacted 🔥"
    this.pushChat(senderId, `reacted ${emoji}`, "reaction");
    this.toAll("reaction:broadcast", { playerId: senderId, emoji });
  }

  /** Thumbs up/down on the current drawing — lands in chat as "X liked the drawing 👍". */
  rateDrawing(senderId: string, rating: "like" | "dislike"): void {
    if (this.phase !== "drawing" && this.phase !== "turnEnd") return;
    if (!this.drawerId || senderId === this.drawerId) return;
    const player = this.players.get(senderId);
    if (!player || !player.connected) return;
    const key = `${senderId}:${rating}`;
    const last = this.lastRateAt.get(key) ?? 0;
    if (now() - last < 2_500) return;
    this.lastRateAt.set(key, now());
    const emoji = rating === "like" ? "👍" : "👎";
    this.pushChat(senderId, rating === "like" ? "liked the drawing 👍" : "disliked the drawing 👎", "reaction");
    // same floating-emoji pipeline as reactions
    this.toAll("reaction:broadcast", { playerId: senderId, emoji });
  }

  // ─── Turn / round / game end ───────────────────────────────────────────────

  private endTurn(): void {
    if (this.phase !== "drawing") return;
    this.clearTimers();

    const results: TurnResultEntry[] = [];
    let correctGuessers = 0;
    let guessers = 0;
    for (const [id, p] of this.players) {
      if (id === this.drawerId) continue;
      guessers++;
      if (p.guessedCurrent) correctGuessers++;
    }
    // drawer points
    if (this.drawerId && correctGuessers > 0) {
      const drawer = this.players.get(this.drawerId);
      if (drawer) {
        const pts = drawerPoints(correctGuessers, guessers);
        drawer.score += pts;
        drawer.turnPoints += pts;
      }
    }
    for (const [id, p] of this.players) {
      results.push({
        playerId: id,
        pointsEarned: p.turnPoints,
        guessed: p.guessedCurrent,
        guessOrder: p.guessedCurrent ? 1 : 0,
      });
    }

    const payload: TurnEndPayload = {
      word: this.word?.word ?? "",
      drawerId: this.drawerId ?? "",
      results,
    };
    this.phase = "turnEnd";
    this.phaseEndsAt = 0;
    this.toAll("turn:end", payload);
    this.broadcastState();
    this.later(TURN_END_MS, () => this.afterTurnEnd());
  }

  private afterTurnEnd(): void {
    const order = [...this.players.keys()];
    if (this.turn >= order.length || order.length < 2) return this.endRound();
    this.nextTurn();
  }

  private endRound(): void {
    this.clearTimers();
    this.phase = "roundEnd";
    this.phaseEndsAt = 0;
    this.toAll("round:end", { round: this.round, leaderboard: this.leaderboard() });
    this.broadcastState();

    if (this.round < this.settings.rounds && this.players.size >= 2) {
      this.later(ROUND_END_MS, () => {
        this.round++;
        this.turn = 0;
        this.nextTurn();
      });
    } else {
      this.later(ROUND_END_MS, () => this.endGame());
    }
  }

  private endGame(): void {
    this.clearTimers();
    this.phase = "gameEnd";
    this.phaseEndsAt = 0;
    this.toAll("game:end", { podium: this.leaderboard(), badges: [] });
    this.broadcastState();
    this.later(GAME_END_MS, () => {
      for (const p of this.players.values()) p.score = 0;
      this.backToLobby(null);
    });
  }

  private backToLobby(message: string | null): void {
    this.clearTimers();
    this.phase = "lobby";
    this.round = 0;
    this.turn = 0;
    this.drawerId = null;
    this.word = null;
    this.wordMask = "";
    this.strokes = [];
    if (message) this.systemMsg(message);
    this.broadcastState();
  }

  private leaderboard(): LeaderboardEntry[] {
    return [...this.players.values()]
      .sort((a, b) => b.score - a.score)
      .map((p, i) => ({ playerId: p.id, name: p.name, score: p.score, rank: i + 1 }));
  }

  // ─── Host controls ─────────────────────────────────────────────────────────

  kick(senderId: string, targetId: string): void {
    const host = this.players.get(senderId);
    if (!host?.isHost || !this.players.has(targetId)) return;
    if (targetId === senderId) return;
    const target = this.players.get(targetId)!;
    this.systemMsg(`${target.name} was kicked by the host`);
    this.finalizeRemoval(targetId);
    this.sockets.get(targetId)?.disconnect(true);
    this.toAll("player:kicked", targetId, "Kicked by host");
  }

  /** Sweep check used by the manager to delete truly empty rooms.
   * Long window: if everyone backgrounds at once, the room must still be
   * here when they all come back. */
  isAbandoned(): boolean {
    return this.players.size === 0 && this.emptySince !== null && now() - this.emptySince > 10 * 60_000;
  }

  destroy(): void {
    this.clearTimers();
    for (const t of this.players.values()) {
      if (t.disconnectTimer) clearTimeout(t.disconnectTimer);
    }
  }
}

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.round(v)));
}

// ─── Manager ─────────────────────────────────────────────────────────────────

export class RoomManager {
  private rooms = new Map<string, Room>();
  constructor(private io: Room["io"]) {}

  create(): Room {
    let code = randomCode();
    while (this.rooms.has(code)) code = randomCode();
    const room = new Room(code, this.io);
    room.onEmpty = (c) => {
      const r = this.rooms.get(c);
      if (r) {
        r.destroy();
        this.rooms.delete(c);
        console.log(`[rooms] ${c} deleted (empty)`);
      }
    };
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  sweep(): void {
    for (const [code, room] of this.rooms) {
      if (room.isAbandoned()) {
        room.destroy();
        this.rooms.delete(code);
        console.log(`[rooms] ${code} deleted (swept)`);
      }
    }
  }

  get count(): number {
    return this.rooms.size;
  }
}
