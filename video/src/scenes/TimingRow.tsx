import {
  Interactive,
  type InteractivitySchema,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, mono, sans } from "../theme";

const SLOWEST_SECONDS = 931;
const RACE_SECONDS = 3.5;
const TRACK_WIDTH = 1000;

const formatTime = (seconds: number) => {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

type TimingRowProps = {
  readonly tool: string;
  readonly model: string;
  readonly seconds: number;
  readonly highlight: boolean;
  readonly style?: React.CSSProperties;
};

const TimingRowInner: React.FC<TimingRowProps> = ({
  tool,
  model,
  seconds,
  highlight,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const elapsed = Math.min(
    seconds,
    interpolate(frame, [0, RACE_SECONDS * fps], [0, SLOWEST_SECONDS], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const done = elapsed >= seconds;
  const color = highlight ? colors.accent : colors.muted;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 40, fontFamily: sans, ...style }}>
      <div style={{ width: 440, flex: "none" }}>
        <div style={{ fontSize: 52, fontWeight: 700, color: colors.foreground }}>{tool}</div>
        <div style={{ fontFamily: mono, fontSize: 28, color: colors.muted }}>{model}</div>
      </div>
      <div
        style={{
          width: TRACK_WIDTH,
          height: 28,
          borderRadius: 14,
          backgroundColor: colors.line,
          flex: "none",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: (elapsed / SLOWEST_SECONDS) * TRACK_WIDTH,
            height: "100%",
            borderRadius: 14,
            backgroundColor: color,
          }}
        />
      </div>
      <div
        style={{
          fontFamily: mono,
          fontSize: 52,
          fontWeight: 500,
          fontVariantNumeric: "tabular-nums",
          color: done ? color : colors.foreground,
        }}
      >
        {formatTime(elapsed)}
      </div>
    </div>
  );
};

const timingRowSchema = {
  tool: { type: "string", default: "building-ui", description: "Tool" },
  model: { type: "string", default: "Opus 5.5 medium", description: "Model" },
  seconds: { type: "number", default: 150, min: 1, max: 931, step: 1, hiddenFromList: false, description: "Seconds to a mock" },
  highlight: { type: "boolean", default: false, description: "Highlight" },
} as const satisfies InteractivitySchema;

export const TimingRow = Interactive.create({
  Component: TimingRowInner,
  layout: "none",
  schema: timingRowSchema,
});
