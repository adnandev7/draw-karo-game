import type { WordDifficulty, WordPackId } from "@drawkaro/shared";

export type WordEntry = {
  word: string;
  difficulty: WordDifficulty;
  /** Extra spellings that count as a correct guess (e.g. "pani puri"). */
  accepted?: string[];
};

export type WordPack = {
  id: WordPackId;
  label: string; // display name, e.g. "Classic"
  emoji: string;
  words: WordEntry[];
};

/**
 * Word design rules (skribbl-style):
 *  - Every word must be DRAWABLE and GUESSABLE in seconds.
 *  - Short, common, concrete vocabulary. Single words preferred;
 *    at most 2–3 words for well-known compounds ("ice cream").
 *  - No long phrases, no sentences, no inside references nobody can draw.
 */

const build = (
  easy: string[],
  medium: string[],
  hard: string[],
  extra: WordEntry[] = []
): WordEntry[] => [
  ...easy.map((w) => ({ word: w, difficulty: "easy" as const })),
  ...medium.map((w) => ({ word: w, difficulty: "medium" as const })),
  ...hard.map((w) => ({ word: w, difficulty: "hard" as const })),
  ...extra,
];

// ─── Classic (English) — the default pack ─────────────────────────────────────

const classicEasy = [
  // animals
  "cat", "dog", "fish", "bird", "snake", "duck", "frog", "mouse", "rabbit",
  "horse", "cow", "pig", "sheep", "chicken", "bear", "lion", "tiger", "monkey",
  "elephant", "zebra", "turtle", "shark", "whale", "crab", "penguin", "owl",
  "bat", "spider", "ant", "bee", "butterfly", "snail", "octopus", "dolphin",
  // nature
  "sun", "moon", "star", "cloud", "rain", "snow", "tree", "flower", "leaf",
  "mountain", "island", "beach", "river", "lake", "wave", "fire", "ice",
  // food & drink
  "apple", "banana", "pizza", "cake", "egg", "milk", "tea", "donut", "cookie",
  "candy", "burger", "fries", "soup", "bread", "cheese", "mango", "lemon",
  "corn", "carrot", "tomato", "potato", "popcorn", "honey", "juice",
  "watermelon", "cupcake", "ice cream",
  // household objects
  "cup", "hat", "shoe", "sock", "book", "key", "clock", "chair", "table",
  "bed", "phone", "lamp", "ring", "coin", "gift", "heart", "kite", "drum",
  "bell", "door", "window", "glasses", "umbrella", "balloon", "candle",
  "scissors", "spoon", "fork", "plate", "bowl", "box", "ball", "teddy bear",
  "paintbrush", "toothbrush",
  // transport
  "car", "bus", "train", "boat", "plane", "bike", "ship", "truck", "taxi",
  // places
  "house", "farm", "park", "school", "castle", "tower", "bridge", "road",
  "tent", "garden", "city",
  // body
  "hand", "foot", "eye", "nose", "ear", "mouth", "teeth", "arm", "leg",
  "head", "hair", "face",
  // people & misc
  "king", "queen", "baby", "ghost", "smile", "crown", "flag", "map",
];

const classicMedium = [
  // animals
  "giraffe", "flamingo", "peacock", "parrot", "eagle", "camel", "llama",
  "koala", "panda", "sloth", "otter", "beaver", "fox", "deer", "moose",
  "raccoon", "hamster", "squirrel", "hedgehog", "lobster", "ostrich",
  "crocodile", "seahorse", "jellyfish", "starfish", "chameleon",
  // characters & myth
  "dragon", "wizard", "mermaid", "vampire", "zombie", "robot", "alien",
  "dinosaur", "unicorn", "fairy", "witch", "monster", "mummy", "skeleton",
  "pirate", "ninja", "samurai", "viking", "pharaoh", "knight", "clown",
  "magician", "genie",
  // professions
  "chef", "doctor", "nurse", "teacher", "farmer", "pilot", "captain",
  "astronaut", "firefighter", "artist", "singer", "dancer", "waiter",
  "barber", "detective", "scientist", "fisherman", "referee", "boxer",
  // nature & weather
  "rainbow", "thunder", "lightning", "tornado", "volcano", "waterfall",
  "desert", "jungle", "earthquake", "sunrise", "sunset", "oasis", "mirror",
  // objects
  "telescope", "ladder", "bucket", "broom", "hammer", "wrench", "compass",
  "anchor", "treasure", "trophy", "medal", "whistle", "microphone", "camera",
  "laptop", "keyboard", "lantern", "torch", "campfire", "hammock", "swing",
  "slide", "trampoline", "parachute", "lighthouse", "windmill", "pyramid",
  "statue", "fountain", "elevator", "submarine", "scooter", "skateboard",
  "surfboard", "wagon", "canoe", "suitcase", "wallet", "necklace",
  "bracelet", "perfume", "binoculars", "sofa", "pillow", "blanket", "curtain",
  "mop", "mask", "barrel", "crate",
  // sports & games
  "basketball", "baseball", "cricket", "tennis", "golf", "hockey", "karate",
  "yoga", "chess", "dice", "frisbee", "darts", "bowling", "archery", "marathon",
  // food & drink
  "sandwich", "noodles", "spaghetti", "taco", "sushi", "kebab", "waffle",
  "coconut", "pineapple", "avocado", "mushroom", "onion", "garlic", "chili",
  "salad", "dumpling", "lemonade", "coffee", "sausage", "meatball", "pancake",
  "peanut", "violin", "piano", "harp",
  // actions
  "sleep", "jump", "dance", "sing", "climb", "swim", "sneeze", "yawn", "hug",
  "cry", "laugh", "whisper", "dream", "paint",
  // misc
  "shadow", "bubble", "magic", "wand", "puzzle", "igloo", "boomerang",
];

const classicHard = [
  // music
  "accordion", "saxophone", "trombone", "banjo", "ukulele", "harmonica",
  "bagpipes", "xylophone", "maracas", "cello", "orchestra",
  // art
  "sculpture", "museum", "gallery", "portrait", "mosaic", "graffiti",
  "chisel", "easel", "palette", "pottery", "origami", "watercolor", "riddle",
  // fantasy & war
  "catapult", "dynamite", "armor", "shield", "sword", "dagger", "spear",
  "arrow", "cannon", "fortress", "dungeon", "labyrinth", "quiver", "satchel",
  "totem", "curse", "rune", "venomous", "crystal", "aurora",
  // science
  "microscope", "pendulum", "magnet", "battery", "circuit", "engine",
  "turbine", "satellite", "laboratory",
  // places & nature
  "mirage", "avalanche", "blizzard", "drought", "quicksand", "whirlpool",
  // rides & transport
  "glider", "gondola", "rickshaw", "unicycle", "trapeze", "carousel",
  "ferris wheel", "roller coaster", "hot air balloon",
  // people
  "ballerina", "gymnast", "juggler",
  // food & drink
  "pretzel", "croissant", "casserole", "lasagna", "marmalade", "espresso",
  "cappuccino", "cocktail", "smoothie", "milkshake", "barbecue",
];

const classic: WordPack = {
  id: "english",
  label: "Classic",
  emoji: "🌍",
  words: build(classicEasy, classicMedium, classicHard, [
    { word: "yo-yo", difficulty: "medium", accepted: ["yoyo"] },
    { word: "tool box", difficulty: "medium", accepted: ["toolbox"] },
    { word: "vacuum cleaner", difficulty: "medium", accepted: ["vacuum"] },
  ]),
};

// ─── Indian Food (small desi accent — all short & drawable) ───────────────────

const indianFood: WordPack = {
  id: "indian-food",
  label: "Indian Food",
  emoji: "🍛",
  words: [
    { word: "samosa", difficulty: "easy" },
    { word: "dosa", difficulty: "easy", accepted: ["masala dosa"] },
    { word: "idli", difficulty: "easy" },
    { word: "chai", difficulty: "easy", accepted: ["tea", "cutting chai"] },
    { word: "lassi", difficulty: "easy" },
    { word: "biryani", difficulty: "easy", accepted: ["biriyani"] },
    { word: "naan", difficulty: "easy" },
    { word: "roti", difficulty: "easy" },
    { word: "curry", difficulty: "easy" },
    { word: "papad", difficulty: "easy" },
    { word: "pickle", difficulty: "easy" },
    { word: "momos", difficulty: "easy", accepted: ["momo"] },
    { word: "jalebi", difficulty: "medium" },
    { word: "dhokla", difficulty: "medium" },
    { word: "paratha", difficulty: "medium" },
    { word: "puri", difficulty: "medium" },
    { word: "pakora", difficulty: "medium", accepted: ["pakoda", "bhajia"] },
    { word: "paneer", difficulty: "medium", accepted: ["paneer tikka"] },
    { word: "kulfi", difficulty: "medium" },
    { word: "rasgulla", difficulty: "medium", accepted: ["roshogolla"] },
    { word: "gol gappa", difficulty: "medium", accepted: ["pani puri", "panipuri", "golgappa", "puchka"] },
    { word: "pav bhaji", difficulty: "medium", accepted: ["paubhaji"] },
    { word: "vada pav", difficulty: "medium", accepted: ["vadapav", "wadapav"] },
    { word: "gulab jamun", difficulty: "medium", accepted: ["gulabjamun"] },
    { word: "butter chicken", difficulty: "medium" },
    { word: "thali", difficulty: "medium" },
    { word: "masala", difficulty: "medium" },
    { word: "chutney", difficulty: "medium" },
    { word: "tandoori", difficulty: "medium" },
  ],
};

// ─── Bollywood (small desi accent — drawable scenes & short titles) ───────────

const bollywood: WordPack = {
  id: "bollywood",
  label: "Bollywood",
  emoji: "🎬",
  words: [
    { word: "hero", difficulty: "easy" },
    { word: "villain", difficulty: "easy" },
    { word: "item song", difficulty: "easy", accepted: ["itemsong"] },
    { word: "rain song", difficulty: "easy", accepted: ["rainsong"] },
    { word: "sad song", difficulty: "easy", accepted: ["sadsong"] },
    { word: "Krrish", difficulty: "easy", accepted: ["krrish"] },
    { word: "3 Idiots", difficulty: "easy", accepted: ["three idiots", "3idiots"] },
    { word: "train scene", difficulty: "medium", accepted: ["trainscene"] },
    { word: "dance number", difficulty: "easy", accepted: ["dancenumber"] },
    { word: "wedding scene", difficulty: "medium", accepted: ["weddingscene"] },
    { word: "action scene", difficulty: "medium", accepted: ["actionscene"] },
    { word: "Dhoom", difficulty: "medium", accepted: ["dhoom"] },
    { word: "Munna Bhai", difficulty: "medium", accepted: ["munnabhai", "munna bhai mbbs"] },
    { word: "Sholay", difficulty: "hard", accepted: ["sholay"] },
    { word: "DDLJ", difficulty: "hard", accepted: ["dilwale dulhania le jayenge"] },
  ],
};

// ─── Memes (small desi accent — funny but drawable) ───────────────────────────

const memes: WordPack = {
  id: "memes",
  label: "Memes",
  emoji: "😂",
  words: [
    { word: "doge", difficulty: "easy" },
    { word: "noice", difficulty: "easy", accepted: ["nice"] },
    { word: "chappal", difficulty: "easy", accepted: ["slipper"] },
    { word: "ghost photo", difficulty: "easy", accepted: ["ghostphoto"] },
    { word: "stonks", difficulty: "medium", accepted: ["stocks"] },
    { word: "trollface", difficulty: "medium", accepted: ["troll face"] },
    { word: "rickroll", difficulty: "medium", accepted: ["rick roll"] },
    { word: "buffering", difficulty: "medium" },
    { word: "exam result", difficulty: "medium", accepted: ["examresult"] },
    { word: "selfie stick", difficulty: "medium", accepted: ["selfiestick"] },
    { word: "gully rap", difficulty: "medium", accepted: ["gully boy rap", "gullyrap"] },
  ],
};

export const WORD_PACKS: Partial<Record<WordPackId, WordPack>> = {
  english: classic,
  "indian-food": indianFood,
  bollywood,
  memes,
  // "cricket", "college-life", "slang-hinglish" — added later (Desi Wave)
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
