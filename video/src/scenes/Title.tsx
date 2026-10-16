import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, mono, sans } from "../theme";

const TitleInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.background,
        justifyContent: "center",
        padding: "0 160px",
        gap: 36,
        fontFamily: sans,
      }}
    >
      <div
        style={{
          fontFamily: mono,
          fontSize: 34,
          color: colors.muted,
          opacity: interpolate(frame, [0, 0.6 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        uxed / building-ui
      </div>
      <div
        style={{
          fontSize: 140,
          fontWeight: 800,
          lineHeight: 1.02,
          letterSpacing: "-0.03em",
          color: colors.foreground,
          opacity: interpolate(frame, [0.2 * fps, 1 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: interpolate(
            frame,
            [0.2 * fps, 1.2 * fps],
            ["0px 40px", "0px 0px"],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            },
          ),
        }}
      >
        From a sketch
        <br />
        to a <span style={{ color: colors.accent }}>mock</span>
      </div>
      <div
        style={{
          fontSize: 48,
          fontWeight: 500,
          color: colors.muted,
          opacity: interpolate(frame, [1 * fps, 1.8 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        A real task, in the app&apos;s own style.
      </div>
    </AbsoluteFill>
  );
};

export const Title = Interactive.create({
  Component: TitleInner,
  layout: "absolute-fill",
});
