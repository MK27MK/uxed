import { Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, mono, sans } from "../theme";
import { Caption } from "./Caption";
import { cameraAt, segmentProgress, worldStyle } from "./camera";

const REPLY = "Looks good, implement it";

const TESTS = [
  "lists every strategy in strategies/ as a compact row",
  "opens the detail on click or Enter and focuses Back",
  'shows "No strategies found" when none match',
  "lists the files that failed to load",
];

const T = {
  typeFrom: 6,
  typeTo: 30,
  send: 38,
  bubbleTo: 52,
  writeTest: 58,
  writeComponent: 68,
  run: 78,
  testFirst: 88,
  testEvery: 9,
  testPass: 7,
  passed: 130,
  captionFrom: 92,
  captionTo: 158,
};

const COMPOSER = { left: 370, width: 1180, bottom: 960, height: 130 };

const SHOTS = [
  { frame: 0, focus: { x: 960, y: 860 }, zoom: 1.45 },
  { frame: 60, focus: { x: 960, y: 520 }, zoom: 1.12 },
];

const appear = (frame: number, at: number) => ({
  opacity: segmentProgress(frame, at, at + 4),
  translate: `0px ${(1 - segmentProgress(frame, at, at + 6)) * 14}px`,
});

const Green = ({ children }: { readonly children: React.ReactNode }) => (
  <span style={{ color: "#3fb950" }}>{children}</span>
);

const ImplementSceneInner = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const camera = cameraAt(frame, SHOTS, 44);

  const sent = frame >= T.send;
  const typed = REPLY.slice(
    0,
    Math.round(interpolate(frame, [T.typeFrom, T.typeTo], [0, REPLY.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })),
  );
  const bubbleIn = segmentProgress(frame, T.send, T.bubbleTo, Easing.bezier(0.16, 1, 0.3, 1));

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
                right: 1920 - 1550,
                top: 130,
                padding: "20px 28px",
                borderRadius: 24,
                background: "#1b2330",
                color: colors.foreground,
                fontFamily: sans,
                fontSize: 30,
                translate: `0px ${(1 - bubbleIn) * 520}px`,
                opacity: bubbleIn,
              }}
            >
              {REPLY}
            </div>
          ) : null}

          <div
            style={{
              position: "absolute",
              left: 400,
              top: 250,
              fontFamily: mono,
              fontSize: 28,
              lineHeight: 1.6,
              color: colors.foreground,
              whiteSpace: "pre",
            }}
          >
            {frame >= T.writeTest ? (
              <div style={appear(frame, T.writeTest)}>
                <Green>● </Green>Write(src/strategies/StrategyList.test.tsx)
              </div>
            ) : null}
            {frame >= T.writeComponent ? (
              <div style={appear(frame, T.writeComponent)}>
                <Green>● </Green>Write(src/strategies/StrategyList.tsx)
              </div>
            ) : null}
            {frame >= T.run ? (
              <div style={{ marginTop: 18, ...appear(frame, T.run) }}>
                <Green>● </Green>Bash(npm test)
              </div>
            ) : null}
            {TESTS.map((name, i) => {
              const at = T.testFirst + i * T.testEvery;
              if (frame < at) return null;
              const passed = frame >= at + T.testPass;
              return (
                <div key={name} style={{ color: passed ? colors.foreground : colors.muted, ...appear(frame, at) }}>
                  {"  "}
                  {passed ? <Green>✓</Green> : "○"} {name}
                </div>
              );
            })}
            {frame >= T.passed ? (
              <div style={{ marginTop: 18, ...appear(frame, T.passed) }}>
                <Green>● </Green>4 tests passed <span style={{ color: colors.muted }}>· from the mock&apos;s 4 rules</span>
              </div>
            ) : null}
          </div>

          <div
            style={{
              position: "absolute",
              left: COMPOSER.left,
              top: COMPOSER.bottom - COMPOSER.height,
              width: COMPOSER.width,
              height: COMPOSER.height,
              borderRadius: 28,
              background: "#161d27",
              border: `2px solid ${sent ? colors.line : "#2c3a4d"}`,
              boxShadow: "0 10px 40px rgb(0 0 0 / 0.35)",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 28,
                bottom: 42,
                fontFamily: sans,
                fontSize: 30,
                color: sent ? colors.muted : colors.foreground,
              }}
            >
              {sent ? "Reply…" : typed}
              {!sent ? (
                <span style={{ display: "inline-block", width: 3, height: 34, marginLeft: 2, verticalAlign: "-6px", background: colors.accent }} />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <Caption anchor={{ x: width / 2, y: 720 }} frame={frame} from={T.captionFrom} to={T.captionTo} side="below">
        Every rule becomes a test
      </Caption>
    </>
  );
};

export const ImplementScene = Interactive.create({
  Component: ImplementSceneInner,
  layout: "absolute-fill",
});
