import {
  CanvasImage,
  Easing,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, mono, sans } from "../theme";
import { Cursor } from "./Cursor";
import {
  cameraAt,
  lerpPoint,
  segmentProgress,
  toScreen,
  worldStyle,
  type Point,
} from "./camera";

const COMMAND = "/building-ui";
const PROMPT =
  " Move strategies to their own tab in the symbol search, as in the sketches. List them from strategies/, open one to edit its parameters, run a backtest and see past runs.";

const SKETCHES = [
  { src: "sketch-1-search.png", aspect: 1302 / 1042 },
  { src: "sketch-2-configuration.png", aspect: 1525 / 1379 },
  { src: "sketch-3-past-runs.png", aspect: 1428 / 1419 },
];

const T = {
  commandFrom: 6,
  commandTo: 21,
  promptFrom: 30,
  promptTo: 44,
  sketchFirst: 50,
  sketchEvery: 21,
  sketchHold: 15,
  sketchFly: 7,
  cursorIn: 114,
  send: 126,
  bubbleTo: 140,
  skill: 144,
  loaded: 150,
  ready: 158,
};

const COMPOSER = { left: 370, width: 1180, bottom: 960, closed: 200, open: 360 };
const THUMB = { width: 168, height: 132, gap: 20, inset: 28 };
const SEND: Point = { x: COMPOSER.left + COMPOSER.width - 64, y: COMPOSER.bottom - 60 };
const BUBBLE = { right: 1550, top: 130, width: 900 };

const SHOTS = [
  { frame: 0, focus: { x: 760, y: 880 }, zoom: 1.9 },
  { frame: 118, focus: { x: 960, y: 760 }, zoom: 1.2 },
  { frame: 156, focus: { x: 960, y: 430 }, zoom: 1.3 },
];

const thumbSlot = (index: number) => ({
  x: COMPOSER.left + THUMB.inset + index * (THUMB.width + THUMB.gap),
  y: COMPOSER.bottom - COMPOSER.open + THUMB.inset,
  width: THUMB.width,
  height: THUMB.height,
});

const SketchCard: React.FC<{
  readonly src: string;
  readonly style: React.CSSProperties;
}> = ({ src, style }) => (
  <div
    style={{
      position: "absolute",
      background: colors.paper,
      borderRadius: 14,
      overflow: "hidden",
      boxShadow: "0 16px 50px rgb(0 0 0 / 0.5)",
      ...style,
    }}
  >
    <CanvasImage
      src={staticFile(src)}
      fit="contain"
      style={{ position: "absolute", inset: 6, width: "calc(100% - 12px)", height: "calc(100% - 12px)" }}
    />
  </div>
);

const PaperPlane = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round">
    <path d="M21.5 2.5 10.5 13.5" />
    <path d="M21.5 2.5 14.5 21.5 10.5 13.5 2.5 9.5Z" />
  </svg>
);

const ChatSceneInner = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const camera = cameraAt(frame, SHOTS, 50);

  const typed =
    COMMAND.slice(0, Math.round(interpolate(frame, [T.commandFrom, T.commandTo], [0, COMMAND.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))) +
    PROMPT.slice(0, Math.round(interpolate(frame, [T.promptFrom, T.promptTo], [0, PROMPT.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
  const sent = frame >= T.send;
  const composerHeight = interpolate(
    frame,
    [T.sketchFirst, T.sketchFirst + 10, T.send, T.send + 10],
    [COMPOSER.closed, COMPOSER.open, COMPOSER.open, 130],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) },
  );
  const caretOn = Math.floor(frame / 8) % 2 === 0 || (frame > T.commandFrom && frame < T.promptTo);

  const sketchTimes = SKETCHES.map((_, i) => {
    const appear = T.sketchFirst + i * T.sketchEvery;
    return { appear, fly: appear + T.sketchHold, land: appear + T.sketchHold + T.sketchFly };
  });

  const bubbleIn = segmentProgress(frame, T.send, T.bubbleTo, Easing.bezier(0.16, 1, 0.3, 1));

  const cursorPath: { frame: number; at: Point }[] = [
    { frame: T.cursorIn, at: { x: 1650, y: 1060 } },
    { frame: T.send - 2, at: toScreen(SEND, camera, width, height) },
  ];
  const cursorAt = lerpPoint(
    cursorPath[0].at,
    cursorPath[1].at,
    segmentProgress(frame, cursorPath[0].frame, cursorPath[1].frame),
  );

  return (
    <>
      <div style={worldStyle(camera, width, height)}>
        <div style={{ position: "absolute", left: 0, top: 0, width, height }}>
          <div
            style={{
              position: "absolute",
              left: 320,
              top: 70,
              width: 1280,
              height: 940,
              borderRadius: 28,
              background: "#11161e",
              border: `1px solid ${colors.line}`,
            }}
          />

          {sent ? (
            <div
              style={{
                position: "absolute",
                left: BUBBLE.right - BUBBLE.width,
                top: BUBBLE.top,
                width: BUBBLE.width,
                padding: 24,
                borderRadius: 24,
                background: "#1b2330",
                color: colors.foreground,
                fontFamily: sans,
                fontSize: 26,
                lineHeight: 1.45,
                translate: `0px ${(1 - bubbleIn) * 520}px`,
                opacity: bubbleIn,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", gap: 14 }}>
                {SKETCHES.map((sketch) => (
                  <SketchCard key={sketch.src} src={sketch.src} style={{ position: "relative", width: 150, height: 118, boxShadow: "none" }} />
                ))}
              </div>
              <div>
                <span style={{ color: colors.accent, fontWeight: 700 }}>{COMMAND}</span>
                {PROMPT}
              </div>
            </div>
          ) : null}

          <div
            style={{
              position: "absolute",
              left: 400,
              top: 470,
              fontFamily: mono,
              fontSize: 28,
              lineHeight: 1.6,
              color: colors.foreground,
            }}
          >
            {frame >= T.skill ? (
              <div style={{ opacity: segmentProgress(frame, T.skill, T.skill + 4) }}>
                <span style={{ color: "#3fb950" }}>● </span>
                <span style={{ fontWeight: 500 }}>Skill</span>(building-ui)
              </div>
            ) : null}
            {frame >= T.loaded ? (
              <div style={{ color: colors.muted, opacity: segmentProgress(frame, T.loaded, T.loaded + 4) }}>
                {"  └ Successfully loaded skill"}
              </div>
            ) : null}
            {frame >= T.ready ? (
              <div style={{ marginTop: 18, opacity: segmentProgress(frame, T.ready, T.ready + 4) }}>
                <span style={{ color: "#3fb950" }}>● </span>
                mock.html ready <span style={{ color: colors.muted }}>· Worked 2m 30s</span>
              </div>
            ) : null}
          </div>

          <div
            style={{
              position: "absolute",
              left: COMPOSER.left,
              top: COMPOSER.bottom - composerHeight,
              width: COMPOSER.width,
              height: composerHeight,
              borderRadius: 28,
              background: "#161d27",
              border: `2px solid ${frame < T.send ? "#2c3a4d" : colors.line}`,
              boxShadow: "0 10px 40px rgb(0 0 0 / 0.35)",
            }}
          >
            {!sent
              ? SKETCHES.map((sketch, i) => {
                  const slot = thumbSlot(i);
                  return frame >= sketchTimes[i].land ? (
                    <SketchCard
                      key={sketch.src}
                      src={sketch.src}
                      style={{
                        left: slot.x - COMPOSER.left,
                        top: slot.y - (COMPOSER.bottom - composerHeight),
                        width: slot.width,
                        height: slot.height,
                        boxShadow: "none",
                      }}
                    />
                  ) : null;
                })
              : null}
            <div
              style={{
                position: "absolute",
                left: THUMB.inset,
                right: 130,
                bottom: 30,
                fontFamily: sans,
                fontSize: 30,
                lineHeight: 1.4,
                color: colors.foreground,
              }}
            >
              {!sent ? (
                <>
                  <span style={{ color: colors.accent, fontWeight: 700 }}>{typed.slice(0, COMMAND.length)}</span>
                  {typed.slice(COMMAND.length)}
                  <span style={{ display: "inline-block", width: 3, height: 34, marginLeft: 2, verticalAlign: "-6px", background: colors.accent, opacity: caretOn ? 1 : 0 }} />
                </>
              ) : (
                <span style={{ color: colors.muted }}>Reply…</span>
              )}
            </div>
            <div
              style={{
                position: "absolute",
                right: 24,
                bottom: 24,
                width: 72,
                height: 72,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                background: typed.length > 0 && !sent ? colors.accent : "#2a3442",
                scale: String(
                  1 - 0.12 * interpolate(frame, [T.send - 3, T.send, T.send + 4], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                ),
              }}
            >
              <PaperPlane />
            </div>
          </div>
        </div>
      </div>

      {SKETCHES.map((sketch, i) => {
        const { appear, fly, land } = sketchTimes[i];
        if (frame < appear || frame >= land) return null;
        const bigHeight = 640;
        const bigWidth = bigHeight * sketch.aspect;
        const big = { x: width / 2 - bigWidth / 2, y: height / 2 - bigHeight / 2 - 40, width: bigWidth, height: bigHeight };
        const slot = thumbSlot(i);
        const slotTop = toScreen({ x: slot.x, y: slot.y }, camera, width, height);
        const small = { x: slotTop.x, y: slotTop.y, width: slot.width * camera.zoom, height: slot.height * camera.zoom };
        const t = segmentProgress(frame, fly, land, Easing.bezier(0.5, 0, 0.2, 1));
        const pop = segmentProgress(frame, appear, appear + 4, Easing.bezier(0.16, 1, 0.3, 1));
        return (
          <SketchCard
            key={sketch.src}
            src={sketch.src}
            style={{
              left: big.x + (small.x - big.x) * t,
              top: big.y + (small.y - big.y) * t,
              width: big.width + (small.width - big.width) * t,
              height: big.height + (small.height - big.height) * t,
              opacity: pop,
              scale: String(0.9 + 0.1 * pop),
            }}
          />
        );
      })}

      <Cursor position={cursorAt} frame={frame} clicks={[T.send]} visible={frame >= T.cursorIn && frame < T.bubbleTo + 4} />
    </>
  );
};

export const ChatScene = Interactive.create({
  Component: ChatSceneInner,
  layout: "absolute-fill",
});
