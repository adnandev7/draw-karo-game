/**
 * Draw Karo design system.
 *
 * Palette and shape language are derived from skribbl.io's shipped CSS
 * (studied live) — deep blue world, translucent panels, crisp 3px corners,
 * flat offset drop shadows, chunky Nunito type — polished for our brand.
 * Import `C` (colors), `F` (fonts), `R` (radii), `flatShadow` everywhere;
 * never hardcode hex values in screens.
 */
import { Platform } from "react-native";

// ─── Colors ───────────────────────────────────────────────────────────────────

export const C = {
  /** World background. */
  bg: "#124da5",
  bgDeep: "#0d3c85",
  bgHi: "#1660c9",

  /** Panels floating over the world. */
  panel: "rgba(12, 44, 150, 0.75)",
  panelDeep: "rgba(7, 36, 131, 0.85)",
  panelBorder: "#040a33",
  panelFocus: "#56b2fd",
  panelText: "#f0f0f0",
  panelDim: "#9b9b9b",

  /** Inputs (light, like skribbl). */
  inputBg: "#ffffff",
  inputText: "#2c2c2c",
  inputBorder: "#707070",
  inputFocus: "#56b2fd",
  /** Soft blue glow ring that hugs every text field (skribbl's input look). */
  inputGlow: "#8fb9f0",

  /** Actions. */
  green: "#53e237",
  greenDeep: "#38c41c",
  blue: "#2c8de7",
  blueDeep: "#1671c5",
  toolActive: "#ab66eb",

  /** Accents. */
  orange: "#ee9631",
  gold: "#ffa844",
  yellow: "#ffc532",
  silver: "#c0c0c0",
  bronze: "#be6029",
  danger: "#d30707",

  /** Chat & player semantics. */
  guessed: "#56CE27",
  guessedBg: "#5bdd4a",
  close: "#e2cb00",
  joined: "#56CE27",
  left: "#CE4F0A",
  me: "#4998ff",
  meGuessed: "#0048b5",
  chatRowAlt: "#ececec",
  // skribbl's saturated green rows for players who guessed the word
  guessedRow: "#8ed671",
  guessedRowAlt: "#7bc95f",

  /** Canvas & overlays. */
  canvas: "#ffffff",
  overlay: "rgba(3, 8, 29, 0.8)",
  canvasInk: "#404040",
} as const;

// ─── Type ─────────────────────────────────────────────────────────────────────

export const F = {
  regular: "Nunito_400Regular",
  semibold: "Nunito_600SemiBold",
  bold: "Nunito_700Bold",
  xbold: "Nunito_800ExtraBold",
  black: "Nunito_900Black",
  /** Word masks & scores tick in a mono face, like skribbl's hint bar. */
  mono: Platform.select({ ios: "Menlo", default: "monospace" }) as string,
} as const;

// ─── Shape ────────────────────────────────────────────────────────────────────

export const R = {
  s: 8,
  m: 12,
  l: 18,
  /** Full pill. */
  pill: 999,
} as const;

/** Flat skribbl-style drop shadow: hard 3px offset, 25% black. */
export const flatShadow = {
  shadowColor: "#000000",
  shadowOpacity: 0.25,
  shadowRadius: 0,
  shadowOffset: { width: 3, height: 3 },
  elevation: 4,
} as const;

/** Softer glow for focus states. */
export const focusGlow = {
  shadowColor: C.panelFocus,
  shadowOpacity: 0.6,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
} as const;

/** The 24 drawing colors: 12 saturated "top" row + 12 soft "bottom" row. */
export const DRAW_COLORS: string[] = [
  "#000000", "#7f7f7f", "#c3c3c3", "#ffffff",
  "#ed1c24", "#ff7f27", "#fff200", "#22b14c",
  "#00a2e8", "#3f48cc", "#a349a4", "#b97a57",
  "#ffb5d4", "#e9c8ae", "#d2d2d2", "#acf0f2",
  "#69d025", "#b5e61d", "#99d9ea", "#7092be",
  "#c8bfe7", "#cc8e5f", "#513b2e", "#7f3f00",
];

/** Relative brush widths (fraction of canvas width), small → XL. */
export const DRAW_SIZES: number[] = [0.004, 0.008, 0.014, 0.024, 0.04];

/** Logo letter colors — funky rainbow, skribbl-style. */
export const LOGO_COLORS: string[] = [
  "#ff5252", "#ff9f43", "#ffd93d", "#6ee76e", "#4cc9f0", "#a78bfa", "#ff8fab", "#ffa844",
];

/** Darken a #rrggbb color by `amount` (0–1). */
export function shade(hex: string, amount: number): string {
  const n = hex.replace("#", "");
  const full = n.length === 3 ? n.split("").map((c) => c + c).join("") : n;
  const num = parseInt(full, 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 - amount))));
  const r = f((num >> 16) & 255);
  const g = f((num >> 8) & 255);
  const b = f(num & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
