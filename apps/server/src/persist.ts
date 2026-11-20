/**
 * Room persistence — snapshots that let a room survive a process restart.
 *
 * Three stores, picked by environment:
 *   MemoryStore  (default)        — same behaviour as before: restarts lose rooms
 *   FileStore    (PERSIST_DIR)    — local dev and the CI restart drill
 *   UpstashStore (UPSTASH_*)      — production; plain REST, no Redis client, no
 *                                   new dependency
 *
 * Only serialisable room state lives here. Sockets, timers and rate-limit
 * windows are deliberately dropped: they cannot be meaningfully restored, and
 * the room re-enters through its normal phase handlers instead (see
 * Room.fromSnapshot/Room.resume).
 */
import fs from "node:fs/promises";
import path from "node:path";
import type { AvatarDescriptor, ChatEntry, GamePhase, RoomSettings, Stroke } from "@drawkaro/shared";

/** A stroke as stored: the fill raster is base64 instead of a Uint8Array. */
export type StoredStroke = Omit<Stroke, "image"> & { image?: string };

export type StoredPlayer = {
  id: string;
  name: string;
  avatar: AvatarDescriptor;
  score: number;
  isHost: boolean;
  guessedCurrent: boolean;
  turnPoints: number;
  guessOrder: number;
  turnStartScore: number;
};

export type RoomSnapshot = {
  /** bump when the shape changes; mismatched snapshots are discarded */
  v: 1;
  code: string;
  savedAt: number;
  settings: RoomSettings;
  phase: GamePhase;
  round: number;
  turn: number;
  drawerId: string | null;
  word: string | null;
  wordMask: string;
  hintsRevealed: number;
  strokes: StoredStroke[];
  chat: ChatEntry[];
  usedWords: string[];
  players: StoredPlayer[];
};

export interface RoomStore {
  readonly persistent: boolean;
  list(): Promise<RoomSnapshot[]>;
  save(snapshot: RoomSnapshot): Promise<void>;
  remove(code: string): Promise<void>;
}

/** Snapshots expire on their own; a room nobody rejoins should not linger. */
const TTL_SECONDS = 6 * 60 * 60;
const KEY_PREFIX = "dk:room:";
/** Redis values and file writes stay well under this; fills are dropped first. */
const MAX_SNAPSHOT_BYTES = 1_500_000;

const keyFor = (code: string) => `${KEY_PREFIX}${code.toUpperCase()}`;

// ─── Size fitting ────────────────────────────────────────────────────────────

function byteSize(snapshot: RoomSnapshot): number {
  return JSON.stringify(snapshot).length;
}

/**
 * Trim until the snapshot fits. Fill images are ~400 KB each, so they go first,
 * then the oldest strokes, then chat. A trimmed room still restores — it just
 * comes back with a partial canvas instead of failing the save entirely.
 */
export function fitSnapshot(
  input: RoomSnapshot,
  maxBytes = MAX_SNAPSHOT_BYTES
): RoomSnapshot {
  let snap = input;
  while (byteSize(snap) > maxBytes) {
    const fillIndex = snap.strokes.findIndex((s) => s.tool === "fill");
    if (fillIndex === -1) break;
    snap = { ...snap, strokes: snap.strokes.filter((_, i) => i !== fillIndex) };
  }
  while (byteSize(snap) > maxBytes && snap.strokes.length > 0) {
    snap = { ...snap, strokes: snap.strokes.slice(1) };
  }
  while (byteSize(snap) > maxBytes && snap.chat.length > 0) {
    snap = { ...snap, chat: snap.chat.slice(1) };
  }
  return snap;
}

/** Guard against garbage from storage: a snapshot must at least be a room. */
export function isSnapshot(value: unknown): value is RoomSnapshot {
  if (!value || typeof value !== "object") return false;
  const snap = value as Partial<RoomSnapshot>;
  return snap.v === 1 && typeof snap.code === "string" && snap.code.length === 4 && Array.isArray(snap.players);
}

// ─── Memory ──────────────────────────────────────────────────────────────────

/** Default store: nothing leaves the process, exactly like before persistence. */
export class MemoryStore implements RoomStore {
  readonly persistent = false;
  async list(): Promise<RoomSnapshot[]> {
    return [];
  }
  async save(): Promise<void> {
    /* no-op */
  }
  async remove(): Promise<void> {
    /* no-op */
  }
}

// ─── Files (local dev + CI restart drill) ────────────────────────────────────

export class FileStore implements RoomStore {
  readonly persistent = true;
  constructor(private dir: string) {}

  private file(code: string): string {
    return path.join(this.dir, `room-${code.toUpperCase()}.json`);
  }

  async list(): Promise<RoomSnapshot[]> {
    let names: string[];
    try {
      names = await fs.readdir(this.dir);
    } catch {
      return [];
    }
    const out: RoomSnapshot[] = [];
    for (const name of names) {
      if (!name.startsWith("room-") || !name.endsWith(".json")) continue;
      try {
        const raw = await fs.readFile(path.join(this.dir, name), "utf8");
        const parsed: unknown = JSON.parse(raw);
        if (isSnapshot(parsed)) out.push(parsed);
      } catch {
        /* a half-written or corrupt file must never block boot */
      }
    }
    return out;
  }

  async save(snapshot: RoomSnapshot): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    const file = this.file(snapshot.code);
    // write-then-rename so a crash never leaves a truncated snapshot
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(snapshot), "utf8");
    await fs.rename(tmp, file);
  }

  async remove(code: string): Promise<void> {
    await fs.rm(this.file(code), { force: true });
  }
}

// ─── Upstash Redis over REST ─────────────────────────────────────────────────

class UpstashStore implements RoomStore {
  readonly persistent = true;

  constructor(
    private url: string,
    private token: string
  ) {}

  private async command(args: Array<string | number>): Promise<unknown> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) throw new Error(`upstash ${res.status} ${res.statusText}`);
    const body = (await res.json()) as { result?: unknown; error?: string };
    if (body.error) throw new Error(`upstash: ${body.error}`);
    return body.result;
  }

  async list(): Promise<RoomSnapshot[]> {
    const keys = (await this.command(["KEYS", `${KEY_PREFIX}*`])) as string[] | null;
    if (!keys || keys.length === 0) return [];
    const out: RoomSnapshot[] = [];
    // rooms are few (≤ 25 on a free instance); serial GETs are fine at boot
    for (const key of keys.slice(0, 100)) {
      const raw = (await this.command(["GET", key])) as string | null;
      if (!raw) continue;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (isSnapshot(parsed)) out.push(parsed);
      } catch {
        /* ignore corrupt value */
      }
    }
    return out;
  }

  async save(snapshot: RoomSnapshot): Promise<void> {
    await this.command(["SET", keyFor(snapshot.code), JSON.stringify(snapshot), "EX", TTL_SECONDS]);
  }

  async remove(code: string): Promise<void> {
    await this.command(["DEL", keyFor(code)]);
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createStore(env: NodeJS.ProcessEnv = process.env): RoomStore {
  const url = env.UPSTASH_REDIS_REST_URL?.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url && token) {
    console.log("[persist] using Upstash Redis");
    return new UpstashStore(url, token);
  }
  const dir = env.PERSIST_DIR?.trim();
  if (dir) {
    console.log(`[persist] using files in ${dir}`);
    return new FileStore(dir);
  }
  console.log("[persist] no store configured — rooms will not survive a restart");
  return new MemoryStore();
}
