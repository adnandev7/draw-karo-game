import type { WordDifficulty, WordPackId } from "@drawkaro/shared";

export type WordEntry = {
  word: string;
  difficulty: WordDifficulty;
  /** Extra spellings that count as a correct guess (e.g. "panner tikka"). */
  accepted?: string[];
};

export type WordPack = {
  id: WordPackId;
  label: string; // display name, e.g. "Bollywood"
  emoji: string;
  words: WordEntry[];
};

// ─── Starter packs (M0 seed — will be expanded to 200–400 words each) ────────

const bollywood: WordPack = {
  id: "bollywood",
  label: "Bollywood",
  emoji: "🎬",
  words: [
    { word: "Sholay", difficulty: "medium" },
    { word: "Dhoom", difficulty: "easy" },
    { word: "Lagaan", difficulty: "medium" },
    { word: "item song", difficulty: "easy", accepted: ["itemsong", "item number"] },
    { word: "hero ki entry", difficulty: "easy" },
    { word: "villain ki moustache", difficulty: "medium" },
    { word: "rain song", difficulty: "easy" },
    { word: "airport goodbye scene", difficulty: "medium" },
    { word: "Dabangg", difficulty: "medium" },
    { word: "DDLJ train scene", difficulty: "medium", accepted: ["ddlj", "dilwale dulhania le jayenge"] },
    { word: "Naagin dance", difficulty: "easy" },
    { word: "thali mein thali", difficulty: "hard" },
    { word: "Bhool Bhulaiyaa", difficulty: "medium" },
    { word: "Krrish", difficulty: "easy" },
    { word: "Munna Bhai MBBS", difficulty: "medium", accepted: ["munnabhai"] },
    { word: "item girl", difficulty: "easy" },
    { word: "helicopter shot celebration", difficulty: "hard" },
    { word: "Slow motion entry", difficulty: "easy" },
    { word: "Jhilmil sitaron ka aangan", difficulty: "hard" },
    { word: "3 Idiots", difficulty: "easy", accepted: ["three idiots"] },
  ],
};

const indianFood: WordPack = {
  id: "indian-food",
  label: "Indian Food",
  emoji: "🍛",
  words: [
    { word: "paneer tikka", difficulty: "easy", accepted: ["panner tikka", "paneer tika"] },
    { word: "samosa", difficulty: "easy" },
    { word: "biryani", difficulty: "easy", accepted: ["biriyani", "biryani rice"] },
    { word: "masala dosa", difficulty: "easy", accepted: ["masala dose", "dosa"] },
    { word: "gol gappa", difficulty: "medium", accepted: ["pani puri", "puchka", "puchke"] },
    { word: "vada pav", difficulty: "easy", accepted: ["wadapav", "vadapav"] },
    { word: "chai", difficulty: "easy", accepted: ["tea", "cutting chai"] },
    { word: "butter chicken", difficulty: "easy" },
    { word: "pav bhaji", difficulty: "easy", accepted: ["paubhaji"] },
    { word: "dhokla", difficulty: "medium" },
    { word: "jalebi", difficulty: "medium" },
    { word: "rasgulla", difficulty: "medium", accepted: ["roshogolla"] },
    { word: "pav bhaji tawa", difficulty: "medium" },
    { word: "momos", difficulty: "easy", accepted: ["momo", "dumpling"] },
    { word: "litti chokha", difficulty: "hard" },
    { word: "dal makhani", difficulty: "medium" },
    { word: "kullu wali chai", difficulty: "hard" },
    { word: "tandoori chicken", difficulty: "easy" },
    { word: "kathi roll", difficulty: "medium", accepted: ["frankie", "kathi roll"] },
    { word: "halwa", difficulty: "easy" },
  ],
};

const memes: WordPack = {
  id: "memes",
  label: "Memes",
  emoji: "😂",
  words: [
    { word: "sasta nasha", difficulty: "medium" },
    { word: "bhai kya kar raha hai tu", difficulty: "easy", accepted: ["bhai kya kar rha hai tu"] },
    { word: "rickroll", difficulty: "medium" },
    { word: "chota bheem", difficulty: "easy" },
    { word: "sharma ji ka beta", difficulty: "easy" },
    { word: "load shedding", difficulty: "hard" },
    { word: "Simmba lion meme", difficulty: "hard" },
    { word: "mid-sem result", difficulty: "medium" },
    { word: "doge", difficulty: "easy" },
    { word: "certificate course", difficulty: "hard" },
    { word: "noice", difficulty: "easy" },
    { word: "chappal nikalna", difficulty: "medium" },
    { word: "uploading 99 percent stuck", difficulty: "medium" },
    { word: "Exam syllabus change notification", difficulty: "hard" },
    { word: "backlog clearance dance", difficulty: "medium" },
    { word: "ghost caught on camera", difficulty: "easy" },
    { word: "didi tumhi ho", difficulty: "hard" },
    { word: "expected vs reality", difficulty: "easy" },
    { word: "monu bhaiya", difficulty: "hard" },
    { word: "gully boy rap", difficulty: "medium" },
  ],
};

export const WORD_PACKS: Partial<Record<WordPackId, WordPack>> = {
  bollywood,
  "indian-food": indianFood,
  memes,
  // "cricket", "college-life", "slang-hinglish" — added in M3 (Desi Wave 1)
};

/** All pack ids that actually have content shipped. */
export function availablePackIds(): WordPackId[] {
  return Object.keys(WORD_PACKS) as WordPackId[];
}

/**
 * Collect words for a room: chosen packs + custom words (Inside Joke Mode).
 * If `onlyCustom` is true, returns ONLY the custom words.
 */
export function collectRoomWords(opts: {
  packs: WordPackId[];
  customWords: string[];
  onlyCustom: boolean;
}): WordEntry[] {
  if (opts.onlyCustom) {
    return opts.customWords.map((w) => ({ word: w, difficulty: "medium" as const }));
  }
  const byDifficulty: Record<WordDifficulty, WordEntry[]> = {
    easy: [],
    medium: [],
    hard: [],
  };
  for (const packId of opts.packs) {
    const pack = WORD_PACKS[packId];
    if (!pack) continue; // pack not shipped yet — skip silently
    for (const entry of pack.words) byDifficulty[entry.difficulty].push(entry);
  }
  const collected = [...byDifficulty.easy, ...byDifficulty.medium, ...byDifficulty.hard];
  for (const w of opts.customWords) collected.push({ word: w, difficulty: "medium" });
  return collected;
}

