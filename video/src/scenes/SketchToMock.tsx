import {
  AbsoluteFill,
  CanvasImage,
  Easing,
  Interactive,
  type InteractivitySchema,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, sans } from "../theme";
import { Eyebrow } from "./Eyebrow";

type SketchToMockProps = {
  readonly step: string;
  readonly title: string;
  readonly sketch: string;
  readonly mock: string;
};

const SketchToMockInner: React.FC<SketchToMockProps> = ({
  step,
  title,
  sketch,
  mock,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.background,
        padding: "100px 110px",
        gap: 20,
        fontFamily: sans,
      }}
    >
      <Eyebrow>{step}</Eyebrow>
      <div
        style={{
          fontSize: 84,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: colors.foreground,
        }}
      >
        {title}
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 40,
        }}
      >
        <CanvasImage
          src={staticFile(sketch)}
          width={660}
          height={620}
          fit="contain"
          style={{
            backgroundColor: colors.paper,
            borderRadius: 18,
            padding: 16,
            flex: "none",
          }}
        />
        <svg width="80" height="48" viewBox="0 0 80 48" style={{ flex: "none" }}>
          <path
            d="M4 24h64M52 8l18 16-18 16"
            fill="none"
            stroke={colors.accent}
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="120"
            strokeDashoffset={interpolate(frame, [0.4 * fps, 1 * fps], [120, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}
          />
        </svg>
        <CanvasImage
          src={staticFile(mock)}
          width={726}
          height={620}
          fit="cover"
          style={{
            borderRadius: 18,
            border: `2px solid ${colors.line}`,
            flex: "none",
            clipPath: `inset(0% ${interpolate(
              frame,
              [0.8 * fps, 1.8 * fps],
              [100, 0],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.65, 0, 0.35, 1),
              },
            )}% 0% 0% round 18px)`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

const sketchToMockSchema = {
  step: { type: "string", default: "Search", description: "Eyebrow" },
  title: { type: "string", default: "Find a strategy", description: "Headline" },
  sketch: { type: "string", default: "sketch-1-search.png", description: "Sketch file" },
  mock: { type: "string", default: "mock-1-search.png", description: "Mock file" },
} as const satisfies InteractivitySchema;

export const SketchToMock = Interactive.create({
  Component: SketchToMockInner,
  layout: "absolute-fill",
  schema: sketchToMockSchema,
});
