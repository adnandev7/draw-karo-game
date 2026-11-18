/**
 * Draw Karo — socket event contract (§7.2 of IMPLEMENTATION_PLAN.md).
 * Both client and server import these to guarantee wire compatibility.
 */
import type {
  AvatarDescriptor,
  BadgeUnlock,
  ChatEntry,
  FillOp,
  LeaderboardEntry,
  RoomSettings,
  RoomState,
  Stroke,
  TurnEndPayload,
} from "./types";

// ─── Client → Server ─────────────────────────────────────────────────────────

export type ClientToServerEvents = {
  // Room lifecycle
  "room:create": (
    settings: Partial<RoomSettings>,
    profile: { profileId: string; name: string; avatar: AvatarDescriptor },
    cb: (res: RoomOpResult) => void
  ) => void;
  "room:join": (
    code: string,
    profile: { profileId: string; name: string; avatar: AvatarDescriptor },
    cb: (res: RoomOpResult) => void
  ) => void;
  "room:leave": () => void;
  "room:settings": (patch: Partial<RoomSettings>) => void;

  // Game flow
  "game:start": () => void;
  "word:choose": (index: number) => void;

  // Drawing (drawer only; server validates)
  "draw:stroke": (delta: { strokeId: string; color: string; width: number; tool: Stroke["tool"]; points: Array<{ x: number; y: number }> }) => void;
  "draw:fill": (fill: FillOp) => void;
  "draw:undo": () => void;
  "draw:clear": () => void;

  // Guessing & chat
  "guess:text": (text: string) => void;
  "chat:msg": (text: string) => void;

  // Social
  "reaction:send": (emoji: string) => void;
  /** Rate the current drawing (skribbl's like/dislike thumbs). */
  "draw:rate": (rating: "like" | "dislike") => void;

  // Funniest Drawing Award
  "award:vote": (drawingOwnerId: string) => void;

  // Host controls
  "host:kick": (playerId: string) => void;
  "host:mute": (playerId: string) => void;
};

export type RoomOpResult =
  | { ok: true; roomState: RoomState }
  | { ok: false; error: string };

// ─── Server → Client ─────────────────────────────────────────────────────────

export type ServerToClientEvents = {
  /** Full snapshot on join, reconnect and major phase changes. */
  "room:state": (state: RoomState) => void;
  "player:joined": (player: RoomState["players"][number]) => void;
  "player:left": (playerId: string) => void;
  "player:kicked": (playerId: string, reason: string) => void;

  "game:started": (round: number) => void;

  /** Drawer receives `words` (the actual options); everyone else gets the mask. */
  "turn:selecting": (p: { drawerId: string; wordMask: string; words?: string[] }) => void;
  /** Everyone gets the mask; the drawer's socket also gets the chosen `word`. */
  "turn:drawing": (p: { drawerId: string; wordLength: number; word?: string }) => void;
  "draw:stroke": (delta: Parameters<ClientToServerEvents["draw:stroke"]>[0]) => void;
  "draw:fill": (fill: FillOp) => void;
  "draw:undo": (strokeId: string | null) => void;
  "draw:clear": () => void;

  "guess:wrong": () => void;
  "guess:close": (hint: string) => void;
  "guess:correct": (p: { playerId: string; points: number; guessOrder: number }) => void;
  "hint:reveal": (wordMask: string) => void;
  "chat:entry": (entry: ChatEntry) => void;

  "turn:end": (payload: TurnEndPayload) => void;
  "round:end": (p: { round: number; leaderboard: LeaderboardEntry[] }) => void;
  "game:end": (p: { podium: LeaderboardEntry[]; badges: BadgeUnlock[] }) => void;

  "award:start": (p: { gallery: Array<{ ownerId: string; snapshot: string }>; voteTimeSec: number }) => void;
  "award:end": (p: { winnerId: string | null; bonusPoints: number; votes: Record<string, number> }) => void;

  "reaction:broadcast": (p: { playerId: string; emoji: string }) => void;

  /** LiveKit access token for this room's voice (minted server-side). */
  "voice:token": (p: { token: string; url: string }) => void;

  "error": (p: { code: string; message: string }) => void;
};

// ─── Scoring (skribbl-faithful) ──────────────────────────────────────────────

/**
 * Guesser points: speed-based, first guesser gets the most (skribbl-faithful).
 * Formula: round(250 * timeRemainingRatio) + 50, scaled down by hint penalty.
 * Max 300 — the fastest guesser on an unhinted word out-scores everyone,
 * including the drawer.
 */
export function guesserPoints(opts: {
  timeRemainingMs: number;
  totalTimeMs: number;
  hintsRevealed: number;
}): number {
  const ratio = Math.max(0, Math.min(1, opts.timeRemainingMs / opts.totalTimeMs));
  const hintPenalty = Math.min(0.5, opts.hintsRevealed * 0.25);
  return Math.round(250 * ratio * (1 - hintPenalty)) + 50;
}

/**
 * Drawer points: scaled by how many players guessed correctly.
 * Formula: round(250 / guessers) * correctGuessers — max 250, so a great
 * drawer is rewarded but never beats the fastest guesser (skribbl keeps the
 * crown with the guessers; the drawer earns a solid assist bonus).
 */
export function drawerPoints(correctGuessers: number, numberOfGuessers: number): number {
  if (numberOfGuessers <= 0) return 0;
  return Math.round((250 / numberOfGuessers) * correctGuessers);
}

// ─── Guess matching ──────────────────────────────────────────────────────────

/** Normalize a guess/word for comparison: lowercase, strip spaces & punctuation. */
export function normalizeGuess(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9]/g, "");
}

/** Compare a guess against a word + its accepted spelling variants. */
export function isGuessCorrect(guess: string, word: string, acceptedVariants: string[] = []): boolean {
  const g = normalizeGuess(guess);
  if (!g) return false;
  const w = normalizeGuess(word);
  if (g === w) return true;
  return acceptedVariants.some((v) => normalizeGuess(v) === g);
}

/** Levenshtein-lite "close" check for the "you're close!" feedback. */
export function isGuessClose(guess: string, word: string): boolean {
  const g = normalizeGuess(guess);
  const w = normalizeGuess(word);
  if (!g || g.length < 3) return false;
  const lenDiff = Math.abs(g.length - w.length);
  if (lenDiff > 2) return false;
  // same length: allow 1 substitution; off-by-one: allow 1 edit
  return levenshtein(g, w) <= 1;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1) // substitution
      );
    }
    prev = curr;
  }
  return prev[n];
}
