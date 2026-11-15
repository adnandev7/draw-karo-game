/**
 * Draw Karo — core domain types.
 * Single source of truth for both the game server and the app.
 */

// ─── Avatar ───────────────────────────────────────────────────────────────────

/** Layered vector avatar descriptor (rendered from parts, ≤ ~1 KB synced). */
export type AvatarDescriptor = {
  skinTone: string;
  expression: string; // part id, e.g. "grin" | "confused" | "sparkle-eyes"
  hairstyle: string; // part id
  accessory: string; // part id ("none" | "chashma" | "cap" | ...)
  outfitColor: string;
};

export const DEFAULT_AVATAR: AvatarDescriptor = {
  skinTone: "#c68642",
  expression: "grin",
  hairstyle: "short-black",
  accessory: "none",
  outfitColor: "#f4a300",
};

// ─── Word packs ──────────────────────────────────────────────────────────────

export type WordPackId =
  | "english"
  | "bollywood"
  | "cricket"
  | "indian-food"
  | "memes"
  | "college-life"
  | "slang-hinglish";

export type WordDifficulty = "easy" | "medium" | "hard";

// ─── Room settings ───────────────────────────────────────────────────────────

export type AwardMode = "off" | "final" | "every2";

export type RoomSettings = {
  rounds: number; // 1–10, default 3
  drawTimeSec: number; // 30–180, default 80
  maxPlayers: number; // 2–16, default 8
  wordChoices: number; // 2–4, default 3
  hints: number; // 0–3 letters revealed per turn, default 2
  packs: WordPackId[]; // selected word packs
  customWords: string[]; // Inside Joke Mode words
  onlyCustom: boolean; // use ONLY custom words
  awardMode: AwardMode; // Funniest Drawing Award trigger
  voice: boolean; // voice chat on/off
};

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  rounds: 3,
  drawTimeSec: 80,
  maxPlayers: 8,
  wordChoices: 3,
  hints: 2,
  packs: ["english", "indian-food"],
  customWords: [],
  onlyCustom: false,
  awardMode: "final",
  voice: true,
};

// ─── Player & room state ─────────────────────────────────────────────────────

export type Player = {
  id: string;
  name: string;
  avatar: AvatarDescriptor;
  score: number;
  isHost: boolean;
  connected: boolean;
  guessedCurrent: boolean;
};

export type GamePhase =
  | "lobby"
  | "selecting" // drawer choosing word
  | "drawing"
  | "turnEnd" // word reveal + turn results
  | "roundEnd" // round leaderboard interstitial
  | "award" // Funniest Drawing Award gallery/voting
  | "gameEnd"; // podium

export type ChatEntry = {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  kind: "chat" | "correct" | "system";
};

/** A drawing stroke. Coordinates normalized 0..1 (resolution independent). */
export type Stroke = {
  id: string;
  color: string;
  width: number; // relative to canvas width, e.g. 0.01
  tool: "brush" | "eraser";
  points: Array<{ x: number; y: number }>;
};

export type RoomState = {
  code: string;
  players: Player[];
  settings: RoomSettings;
  phase: GamePhase;
  drawerId: string | null;
  wordMask: string; // underscores + revealed letters, e.g. "p _ _ _ _ _"
  timeLeftMs: number;
  round: number;
  turn: number;
  /** Full stroke history for the current turn (used for late join / resync). */
  strokes: Stroke[];
  chat: ChatEntry[];
};

// ─── Turn results & awards ───────────────────────────────────────────────────

export type TurnResultEntry = {
  playerId: string;
  pointsEarned: number;
  guessed: boolean;
  guessOrder: number; // 1 = first correct
};

export type TurnEndPayload = {
  word: string;
  drawerId: string;
  results: TurnResultEntry[];
  /** PNG snapshot of the drawing (base64) — kept for the Funniest Award gallery. */
  snapshot?: string;
};

export type LeaderboardEntry = {
  playerId: string;
  name: string;
  score: number;
  rank: number;
};

export type BadgeId =
  | "fastest-guesser"
  | "picasso"
  | "worst-artist"
  | "mind-reader"
  | "comeback-king"
  | "comedy-king"
  | "hype-squad"
  | "radio-jockey";

export type BadgeUnlock = {
  badgeId: BadgeId;
  playerId: string;
  unlockedAt: number;
};
