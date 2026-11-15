/**
 * Draw Karo game store — socket events → React state (zustand).
 * The server is the source of truth; this store mirrors `room:state`.
 */
import { create } from "zustand";
import {
  DEFAULT_AVATAR,
  type AvatarDescriptor,
  type BadgeUnlock,
  type LeaderboardEntry,
  type RoomSettings,
  type RoomState,
  type Stroke,
  type TurnResultEntry,
} from "@drawkaro/shared";
import { socket } from "../lib/socket";
import { storageGet, storageSet } from "../lib/storage";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

export type Profile = {
  profileId: string;
  name: string;
  avatar: AvatarDescriptor;
};

export type TurnEndData = {
  word: string;
  drawerId: string;
  results: TurnResultEntry[];
};

export type RoundEndData = {
  round: number;
  leaderboard: LeaderboardEntry[];
};

export type GameEndData = {
  podium: LeaderboardEntry[];
  badges: BadgeUnlock[];
};

export type StrokeDelta = {
  strokeId: string;
  color: string;
  width: number;
  tool: Stroke["tool"];
  points: { x: number; y: number }[];
};

function loadProfile(): Profile {
  // Name + avatar persist across tabs (localStorage); the player ID is
  // per-tab (sessionStorage on web) so multiple tabs = multiple players,
  // while a refresh still keeps the same identity for reconnects.
  let name = "";
  let avatar = DEFAULT_AVATAR;
  const raw = storageGet("profile");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { name?: string; avatar?: AvatarDescriptor };
      if (typeof parsed.name === "string") name = parsed.name;
      if (parsed.avatar) avatar = parsed.avatar;
    } catch {
      /* fallthrough */
    }
  }
  let profileId = storageGet("profileId", "session");
  if (!profileId) {
    profileId = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    storageSet("profileId", profileId, "session");
  }
  return { profileId, name, avatar };
}

type GameStore = {
  profile: Profile;
  connection: ConnectionStatus;
  errorMsg: string | null;
  room: RoomState | null;

  // per-turn transient state
  myWordOptions: string[] | null; // drawer's word choices
  myWord: string | null; // drawer's chosen word
  closeHint: string | null; // "you're close!" toast
  turnEnd: TurnEndData | null;
  roundEnd: RoundEndData | null;
  gameEnd: GameEndData | null;
  lastReaction: { emoji: string; playerId: string; ts: number } | null;

  setName: (name: string) => void;
  setAvatar: (patch: Partial<AvatarDescriptor>) => void;
  createRoom: (settings?: Partial<RoomSettings>) => void;
  joinRoom: (code: string) => void;
  leaveRoom: () => void;
  startGame: () => void;
  updateSettings: (patch: Partial<RoomSettings>) => void;
  chooseWord: (index: number) => void;
  pushStrokeBatch: (delta: StrokeDelta) => void;
  undoStroke: () => void;
  clearCanvas: () => void;
  sendGuess: (text: string) => void;
  sendChat: (text: string) => void;
  sendReaction: (emoji: string) => void;
  dismissTurnEnd: () => void;
};

let closeHintTimer: ReturnType<typeof setTimeout> | null = null;

export const useGame = create<GameStore>((set, get) => ({
  profile: loadProfile(),
  connection: "idle",
  errorMsg: null,
  room: null,
  myWordOptions: null,
  myWord: null,
  closeHint: null,
  turnEnd: null,
  roundEnd: null,
  gameEnd: null,
  lastReaction: null,

  setName: (name) => {
    const profile = { ...get().profile, name: name.slice(0, 16) };
    set({ profile });
    // shared preferences only — the per-tab profileId stays out of localStorage
    storageSet("profile", JSON.stringify({ name: profile.name, avatar: profile.avatar }));
  },

  setAvatar: (patch) => {
    const profile = {
      ...get().profile,
      avatar: { ...get().profile.avatar, ...patch },
    };
    set({ profile });
    storageSet("profile", JSON.stringify({ name: profile.name, avatar: profile.avatar }));
  },

  createRoom: (settings) => {
    set({ connection: "connecting", errorMsg: null });
    socket.connect();
    socket.emit("room:create", settings ?? {}, get().profile, (res) => {
      if (res.ok) {
        set({ room: res.roomState, connection: "connected" });
      } else {
        set({ connection: "error", errorMsg: res.error });
      }
    });
  },

  joinRoom: (code) => {
    set({ connection: "connecting", errorMsg: null });
    socket.connect();
    socket.emit("room:join", code.trim().toUpperCase(), get().profile, (res) => {
      if (res.ok) {
        set({ room: res.roomState, connection: "connected" });
      } else {
        set({ connection: "error", errorMsg: res.error });
      }
    });
  },

  leaveRoom: () => {
    socket.emit("room:leave");
    set({
      room: null,
      connection: "idle",
      myWordOptions: null,
      myWord: null,
      closeHint: null,
      turnEnd: null,
      roundEnd: null,
      gameEnd: null,
    });
  },

  startGame: () => socket.emit("game:start"),
  updateSettings: (patch) => socket.emit("room:settings", patch),
  chooseWord: (index) => socket.emit("word:choose", index),

  pushStrokeBatch: (delta) => {
    const room = get().room;
    if (!room) return;
    // optimistic local append; server snapshots carry the same content
    const seg: Stroke = {
      id: delta.strokeId,
      color: delta.color,
      width: delta.width,
      tool: delta.tool,
      points: delta.points,
    };
    set({ room: { ...room, strokes: [...room.strokes, seg] } });
    socket.emit("draw:stroke", delta);
  },

  undoStroke: () => {
    const room = get().room;
    if (!room || room.strokes.length === 0) return;
    const lastId = room.strokes[room.strokes.length - 1].id;
    set({
      room: { ...room, strokes: room.strokes.filter((s) => s.id !== lastId) },
    });
    socket.emit("draw:undo");
  },

  clearCanvas: () => {
    const room = get().room;
    if (!room) return;
    set({ room: { ...room, strokes: [] } });
    socket.emit("draw:clear");
  },

  sendGuess: (text) => socket.emit("guess:text", text),
  sendChat: (text) => socket.emit("chat:msg", text),
  sendReaction: (emoji) => socket.emit("reaction:send", emoji),

  dismissTurnEnd: () => set({ turnEnd: null }),
}));

// ─── Socket → store wiring (registered once at import time) ──────────────────

socket.on("room:state", (state) => {
  useGame.setState((s) => {
    const next: Partial<GameStore> = { room: state };
    // transient overlays live only while their phase is active. The turn:end /
    // round:end payloads usually arrive BEFORE the matching snapshot, so never
    // wipe them on phase entry — only clear when the phase has moved on.
    if (state.phase !== "turnEnd") next.turnEnd = null;
    if (state.phase !== "roundEnd") next.roundEnd = null;
    if (state.phase !== "gameEnd") next.gameEnd = null;
    if (state.phase !== "selecting") next.myWordOptions = null;
    if (state.phase !== "drawing") next.myWord = null;
    // guessers receive incremental strokes via events; snapshots replace them
    return next;
  });
});

socket.on("turn:selecting", (p) => {
  if (p.words) useGame.setState({ myWordOptions: p.words });
});

socket.on("turn:drawing", (p) => {
  useGame.setState({ myWord: p.word ?? null, myWordOptions: null });
});

socket.on("draw:stroke", (delta) => {
  useGame.setState((s) => {
    if (!s.room) return {};
    const seg: Stroke = {
      id: delta.strokeId,
      color: delta.color,
      width: delta.width,
      tool: delta.tool,
      points: delta.points,
    };
    return { room: { ...s.room, strokes: [...s.room.strokes, seg] } };
  });
});

socket.on("draw:undo", (strokeId) => {
  useGame.setState((s) => {
    if (!s.room) return {};
    return {
      room: { ...s.room, strokes: strokeId ? s.room.strokes.filter((st) => st.id !== strokeId) : [] },
    };
  });
});

socket.on("draw:clear", () => {
  useGame.setState((s) => (s.room ? { room: { ...s.room, strokes: [] } } : {}));
});

socket.on("guess:close", (hint) => {
  useGame.setState({ closeHint: hint });
  if (closeHintTimer) clearTimeout(closeHintTimer);
  closeHintTimer = setTimeout(() => useGame.setState({ closeHint: null }), 3_000);
});

socket.on("guess:correct", (p) => {
  const room = useGame.getState().room;
  if (!room) return;
  useGame.setState({
    room: {
      ...room,
      players: room.players.map((pl) =>
        pl.id === p.playerId ? { ...pl, guessedCurrent: true, score: pl.score + p.points } : pl
      ),
    },
  });
});

socket.on("chat:entry", (entry) => {
  useGame.setState((s) => (s.room ? { room: { ...s.room, chat: [...s.room.chat, entry] } } : {}));
});

socket.on("turn:end", (payload) => useGame.setState({ turnEnd: payload }));
socket.on("round:end", (p) => useGame.setState({ roundEnd: p }));
socket.on("game:end", (p) => useGame.setState({ gameEnd: p }));

socket.on("reaction:broadcast", (p) => {
  useGame.setState({ lastReaction: { emoji: p.emoji, playerId: p.playerId, ts: Date.now() } });
});

socket.on("player:kicked", (playerId, reason) => {
  const me = useGame.getState().profile;
  if (playerId === me.profileId) {
    useGame.setState({
      room: null,
      errorMsg: reason || "You were removed from the room",
      connection: "idle",
    });
    return;
  }
  useGame.setState((s) =>
    s.room ? { room: { ...s.room, players: s.room.players.filter((pl) => pl.id !== playerId) } } : {}
  );
});

socket.on("error", (p) => {
  useGame.setState({ errorMsg: p.message });
  setTimeout(() => useGame.setState({ errorMsg: null }), 4_000);
});

socket.on("connect", () => {
  // Reconnect handling: re-join the room we were in with the same profile
  const { room, profile } = useGame.getState();
  useGame.setState({ connection: room ? "connected" : "idle" });
  if (room) {
    socket.emit("room:join", room.code, profile, (res) => {
      if (res.ok) useGame.setState({ room: res.roomState });
    });
  }
});

socket.on("disconnect", () => {
  useGame.setState((s) => (s.room ? { connection: "connecting" } : { connection: "idle" }));
});
