/**
 * DrawCanvas — Skia canvas with live stroke drawing and remote stroke rendering.
 * Coordinates are normalized 0..1 so every device renders identically.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { Canvas, Fill, Path, Skia, type SkPath } from "@shopify/react-native-skia";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import type { Stroke } from "@drawkaro/shared";
import type { StrokeDelta } from "../../store/game";

const CANVAS_BG = "#ffffff";
const FLUSH_MS = 50;
/** Ignore points closer than this (in normalized units) to keep payloads small. */
const MIN_POINT_DIST = 0.006;

export type DrawCanvasProps = {
  isDrawer: boolean;
  strokes: Stroke[];
  color: string;
  width: number; // normalized to canvas size, e.g. 0.012
  tool: "brush" | "eraser";
  onBatch: (delta: StrokeDelta) => void;
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

function DrawCanvasInner({ isDrawer, strokes, color, width, tool, onBatch }: Props) {
  const { width: winWidth } = useWindowDimensions();
  // skribbl draws on a 4:3 surface — fill the available card space with it
  // instead of a small centered square.
  const [dims, setDims] = useState({ w: Math.min(winWidth - 16, 533), h: Math.min(winWidth - 16, 533) * 0.75 });
  const gestureId = useRef("");
  const pending = useRef<{ x: number; y: number }[]>([]);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const flushTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const toolRef = useRef({ color, width, tool });
  useEffect(() => {
    toolRef.current = { color, width, tool };
  }, [color, width, tool]);

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
          gestureId.current = `g_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const p = { x: e.x / dims.w, y: e.y / dims.h };
          pending.current = [p];
          lastPoint.current = p;
          startFlushTimer();
        })
        .onUpdate((e) => {
          const p = { x: e.x / dims.w, y: e.y / dims.h };
          const last = lastPoint.current;
          if (last && Math.hypot(p.x - last.x, p.y - last.y) < MIN_POINT_DIST) return;
          lastPoint.current = p;
          pending.current.push(p);
        })
        .onEnd(() => {
          stopFlushTimer();
          flush();
        })
        .onFinalize(() => stopFlushTimer()),
    [isDrawer, dims, startFlushTimer, stopFlushTimer, flush]
  );
  /* eslint-enable react-hooks/refs, react-hooks/purity */

  const paths = useMemo(
    () =>
      strokes
        .map((s) => ({ path: buildSkPath(s, dims.w, dims.h), color: s.color, width: s.width }))
        .filter((p) => !p.path.isEmpty()),
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
            {paths.map((p, i) => (
              <Path
                key={i}
                path={p.path}
                style="stroke"
                strokeWidth={Math.max(1, p.width * dims.w)}
                color={p.color}
                strokeCap="round"
                strokeJoin="round"
              />
            ))}
          </Canvas>
        </GestureDetector>
      </View>
    </View>
  );
}

export const DrawCanvas = memo(DrawCanvasInner);
