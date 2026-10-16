import {
  AbsoluteFill,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, mono, sans } from "../theme";

const OutroInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.background,
        justifyContent: "center",
        alignItems: "center",
        gap: 48,
        fontFamily: sans,
      }}
    >
      <div
        style={{
          fontSize: 120,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          color: colors.foreground,
        }}
      >
        uxed
      </div>
      <div
        style={{
          fontFamily: mono,
          fontSize: 52,
          color: colors.foreground,
          backgroundColor: colors.line,
          borderRadius: 16,
          padding: "24px 40px",
          opacity: interpolate(frame, [0.4 * fps, 1 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <span style={{ color: colors.accent }}>$</span> npx skills add MK27MK/uxed
      </div>
    </AbsoluteFill>
  );
};

export const Outro = Interactive.create({
  Component: OutroInner,
  layout: "absolute-fill",
});
