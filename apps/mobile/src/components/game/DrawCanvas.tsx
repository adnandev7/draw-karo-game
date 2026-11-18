/**
 * DrawCanvas — Skia canvas with live stroke drawing and remote stroke rendering.
 * Coordinates are normalized 0..1 so every device renders identically.
 *
 * Paint bucket: flood fill needs pixels, so the drawer rasterizes the current
 * board offscreen at a fixed 1000px width, flood-fills from the tap point and
 * ships the resulting PNG as a fill op. Every client replays that image in
 * order with the strokes, so all screens stay pixel-identical.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import {
  AlphaType,
  Canvas,
  ColorType,
  Fill,
  Image as SkiaImage,
  PaintStyle,
  Path,
  Skia,
  StrokeCap,
  StrokeJoin,
  type SkCanvas,
  type SkImage,
  type SkPath,
} from "@shopify/react-native-skia";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import type { DrawTool, FillOp, Stroke } from "@drawkaro/shared";
import type { StrokeDelta } from "../../store/game";

const CANVAS_BG = "#ffffff";
const FLUSH_MS = 50;
/** Ignore points closer than this (in normalized units) to keep payloads small. */
const MIN_POINT_DIST = 0.006;
/** Internal raster width for paint-bucket fills (4:3 → 1000×750). */
const FILL_W = 1000;
/** Flood-fill colour tolerance (squared RGB distance). */
const FILL_TOLERANCE = 2500;

export type DrawCanvasProps = {
  isDrawer: boolean;
  strokes: Stroke[];
  color: string;
  width: number; // normalized to canvas size, e.g. 0.012
  tool: DrawTool;
  onBatch: (delta: StrokeDelta) => void;
  onFill: (fill: FillOp) => void;
};

type Props = DrawCanvasProps;

function buildSkPath(stroke: Stroke, w: number, h: number): SkPath {
  const builder = Skia.PathBuilder.Make();
  const pts = stroke.points;
  if (pts.length > 0) {
    builder.moveTo(pts[0].x * w, pts[0].y * h);
    for (let i = 1; i < pts.length; i++) {
      builder.lineTo(pts[i].x * w, pts[i].y * h);
    }
  }
  return builder.build();
}

// ─── Fill-op images (decoded once, reused by renders and later fills) ────────

const fillImageCache = new Map<string, SkImage>();

function decodeFillImage(stroke: Stroke): SkImage | null {
  if (!stroke.image) return null;
  const cached = fillImageCache.get(stroke.id);
  if (cached) return cached;
  const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(stroke.image));
  if (!image) return null;
  if (fillImageCache.size > 80) fillImageCache.clear();
  fillImageCache.set(stroke.id, image);
  return image;
}

/** Paint every op — strokes and earlier fills — into an offscreen canvas. */
function drawOpsTo(canvas: SkCanvas, ops: Stroke[], w: number, h: number) {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  for (const s of ops) {
    if (s.tool === "fill") {
      const image = decodeFillImage(s);
      if (!image) continue;
      paint.setStyle(PaintStyle.Fill);
      canvas.drawImageRect(
        image,
        { x: 0, y: 0, width: image.width(), height: image.height() },
        { x: 0, y: 0, width: w, height: h },
        paint
      );
      continue;
    }
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeWidth(Math.max(1, s.width * w));
    paint.setStrokeCap(StrokeCap.Round);
    paint.setStrokeJoin(StrokeJoin.Round);
    paint.setColor(Skia.Color(s.color));
    canvas.drawPath(buildSkPath(s, w, h), paint);
  }
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** 4-connected flood fill on RGBA bytes; returns false when nothing changed. */
function floodFill(
  px: Uint8Array,
  w: number,
  h: number,
  nx: number,
  ny: number,
  hex: string
): boolean {
  const sx = Math.min(w - 1, Math.max(0, Math.round(nx * w)));
  const sy = Math.min(h - 1, Math.max(0, Math.round(ny * h)));
  const start = (sy * w + sx) * 4;
  const tr = px[start];
  const tg = px[start + 1];
  const tb = px[start + 2];
  const { r, g, b } = parseHex(hex);
  if (Math.abs(tr - r) < 3 && Math.abs(tg - g) < 3 && Math.abs(tb - b) < 3) return false;

  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let sp = 0;
  stack[sp++] = sy * w + sx;
  seen[sy * w + sx] = 1;
  let changed = false;

  while (sp > 0) {
    const p = stack[--sp];
    const i = p * 4;
    const dr = px[i] - tr;
    const dg = px[i + 1] - tg;
    const db = px[i + 2] - tb;
    if (dr * dr + dg * dg + db * db > FILL_TOLERANCE) continue;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = 255;
    changed = true;
    const x = p % w;
    const y = (p / w) | 0;
    if (x > 0 && !seen[p - 1]) {
      seen[p - 1] = 1;
      stack[sp++] = p - 1;
    }
    if (x < w - 1 && !seen[p + 1]) {
      seen[p + 1] = 1;
      stack[sp++] = p + 1;
    }
    if (y > 0 && !seen[p - w]) {
      seen[p - w] = 1;
      stack[sp++] = p - w;
    }
    if (y < h - 1 && !seen[p + w]) {
      seen[p + w] = 1;
      stack[sp++] = p + w;
    }
  }
  return changed;
}

function DrawCanvasInner({ isDrawer, strokes, color, width, tool, onBatch, onFill }: Props) {
  const { width: winWidth } = useWindowDimensions();
  // skribbl draws on a 4:3 surface — fill the available card space with it
  // instead of a small centered square.
  const [dims, setDims] = useState({ w: Math.min(winWidth - 16, 533), h: Math.min(winWidth - 16, 533) * 0.75 });
  const gestureId = useRef("");
  const pending = useRef<{ x: number; y: number }[]>([]);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const flushTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const toolRef = useRef({ color, width, tool });
  const strokesRef = useRef(strokes);
  const onFillRef = useRef(onFill);
  const filling = useRef(false);
  useEffect(() => {
    toolRef.current = { color, width, tool };
  }, [color, width, tool]);
  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);
  useEffect(() => {
    onFillRef.current = onFill;
  }, [onFill]);

  const flush = useCallback(() => {
    if (pending.current.length === 0) return;
    const delta: StrokeDelta = {
      strokeId: gestureId.current,
      color: toolRef.current.tool === "eraser" ? CANVAS_BG : toolRef.current.color,
      width: toolRef.current.width,
      tool: toolRef.current.tool,
      points: pending.current,
    };
    pending.current = [];
    lastPoint.current = null;
    onBatch(delta);
  }, [onBatch]);

  const startFlushTimer = useCallback(() => {
    if (flushTimer.current) return;
    flushTimer.current = setInterval(flush, FLUSH_MS);
  }, [flush]);

  const stopFlushTimer = useCallback(() => {
    if (flushTimer.current) {
      clearInterval(flushTimer.current);
      flushTimer.current = null;
    }
  }, []);

  // Paint bucket: rasterize the board, flood fill at the tap point, ship the
  // resulting PNG. Runs off the render path, guarded so a double tap can't
  // queue two fills on the same board.
  const performFill = useCallback(
    (nx: number, ny: number) => {
      if (filling.current) return;
      filling.current = true;
      try {
        const w = FILL_W;
        const h = Math.max(1, Math.round((w * dims.h) / dims.w));
        const surface = Skia.Surface.Make(w, h) ?? Skia.Surface.MakeOffscreen(w, h);
        if (!surface) return;
        const canvas = surface.getCanvas();
        canvas.clear(Skia.Color(CANVAS_BG));
        drawOpsTo(canvas, strokesRef.current, w, h);
        const snapshot = surface.makeImageSnapshot();
        const info = {
          width: w,
          height: h,
          colorType: ColorType.RGBA_8888,
          alphaType: AlphaType.Unpremul,
        };
        const px = snapshot.readPixels(0, 0, info);
        if (!(px instanceof Uint8Array)) return;
        if (!floodFill(px, w, h, nx, ny, toolRef.current.color)) return;
        const filled = Skia.Image.MakeImage(info, Skia.Data.fromBytes(px), w * 4);
        if (!filled) return;
        onFillRef.current({
          id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          color: toolRef.current.color,
          seed: { x: nx, y: ny },
          image: filled.encodeToBytes(),
        });
      } finally {
        filling.current = false;
      }
    },
    [dims]
  );

  const performFillRef = useRef(performFill);
  useEffect(() => {
    performFillRef.current = performFill;
  }, [performFill]);

  // Gesture callbacks are event handlers (not render code); refs here are the
  // points buffer for the in-flight stroke, and stroke IDs use Date.now/random.
  // The react-compiler lint rules can't tell event handlers from render.
  /* eslint-disable react-hooks/refs, react-hooks/purity */
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(isDrawer)
        .minDistance(0)
        .onBegin((e) => {
          if (toolRef.current.tool === "fill") return;
          gestureId.current = `g_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const p = { x: e.x / dims.w, y: e.y / dims.h };
          pending.current = [p];
          lastPoint.current = p;
          startFlushTimer();
        })
        .onUpdate((e) => {
          if (toolRef.current.tool === "fill") return;
          const p = { x: e.x / dims.w, y: e.y / dims.h };
          const last = lastPoint.current;
          if (last && Math.hypot(p.x - last.x, p.y - last.y) < MIN_POINT_DIST) return;
          lastPoint.current = p;
          pending.current.push(p);
        })
        .onEnd((e) => {
          if (toolRef.current.tool === "fill") {
            performFillRef.current(
              Math.min(1, Math.max(0, e.x / dims.w)),
              Math.min(1, Math.max(0, e.y / dims.h))
            );
            return;
          }
          stopFlushTimer();
          flush();
        })
        .onFinalize(() => stopFlushTimer()),
    [isDrawer, dims, startFlushTimer, stopFlushTimer, flush]
  );
  /* eslint-enable react-hooks/refs, react-hooks/purity */

  const ops = useMemo(
    () =>
      strokes.map((s) => {
        if (s.tool === "fill") {
          return { kind: "image" as const, id: s.id, image: decodeFillImage(s) };
        }
        const path = buildSkPath(s, dims.w, dims.h);
        if (path.isEmpty()) return null;
        return { kind: "path" as const, id: s.id, path, color: s.color, width: s.width };
      }).filter((op): op is NonNullable<typeof op> => op !== null),
    [strokes, dims]
  );

  const onLayout = useCallback((e: { width: number; height: number }) => {
    // fit a 4:3 surface into the available card space
    const availW = Math.max(0, e.width - 8);
    const availH = Math.max(0, e.height - 8);
    const w = Math.floor(Math.min(availW, (availH * 4) / 3));
    const h = Math.floor((w * 3) / 4);
    if (w > 0 && h > 0) setDims((d) => (Math.abs(d.w - w) < 2 && Math.abs(d.h - h) < 2 ? d : { w, h }));
  }, []);

  return (
    <View
      onLayout={(e) => onLayout(e.nativeEvent.layout)}
      style={{
        flex: 1,
        alignSelf: "stretch",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: dims.w,
          height: dims.h,
          borderRadius: 12,
          overflow: "hidden",
          borderWidth: 2,
          borderColor: "#d8e6f5",
          backgroundColor: CANVAS_BG,
        }}
      >
        <GestureDetector gesture={gesture}>
          <Canvas style={{ width: dims.w, height: dims.h }}>
            <Fill color={CANVAS_BG} />
            {ops.map((op) =>
              op.kind === "image" ? (
                op.image ? (
                  <SkiaImage
                    key={op.id}
                    image={op.image}
                    x={0}
                    y={0}
                    width={dims.w}
                    height={dims.h}
                    fit="fill"
                  />
                ) : null
              ) : (
                <Path
                  key={op.id}
                  path={op.path}
                  style="stroke"
                  strokeWidth={Math.max(1, op.width * dims.w)}
                  color={op.color}
                  strokeCap="round"
                  strokeJoin="round"
                />
              )
            )}
          </Canvas>
        </GestureDetector>
      </View>
    </View>
  );
}

export const DrawCanvas = memo(DrawCanvasInner);
