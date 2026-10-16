import {
  AbsoluteFill,
  CanvasImage,
  Easing,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, sans } from "../theme";
import { Eyebrow } from "./Eyebrow";

const InputInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.background,
        padding: "110px 120px",
        gap: 28,
        fontFamily: sans,
      }}
    >
      <Eyebrow>Input</Eyebrow>
      <div
        style={{
          fontSize: 88,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: colors.foreground,
        }}
      >
        Three sketches and a spec
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          gap: 48,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CanvasImage
          src={staticFile("sketch-1-search.png")}
          width={500}
          height={420}
          fit="contain"
          style={{
            backgroundColor: colors.paper,
            borderRadius: 18,
            padding: 16,
            rotate: "-2.5deg",
            opacity: interpolate(frame, [0.3 * fps, 0.9 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            translate: interpolate(
              frame,
              [0.3 * fps, 1.1 * fps],
              ["0px 80px", "0px 0px"],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              },
            ),
          }}
        />
        <CanvasImage
          src={staticFile("sketch-2-configuration.png")}
          width={500}
          height={420}
          fit="contain"
          style={{
            backgroundColor: colors.paper,
            borderRadius: 18,
            padding: 16,
            rotate: "1.5deg",
            opacity: interpolate(frame, [0.6 * fps, 1.2 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            translate: interpolate(
              frame,
              [0.6 * fps, 1.4 * fps],
              ["0px 80px", "0px 0px"],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              },
            ),
          }}
        />
        <CanvasImage
          src={staticFile("sketch-3-past-runs.png")}
          width={500}
          height={420}
          fit="contain"
          style={{
            backgroundColor: colors.paper,
            borderRadius: 18,
            padding: 16,
            rotate: "-1deg",
            opacity: interpolate(frame, [0.9 * fps, 1.5 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            translate: interpolate(
              frame,
              [0.9 * fps, 1.7 * fps],
              ["0px 80px", "0px 0px"],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              },
            ),
          }}
        />
      </div>
      <div
        style={{
          fontSize: 44,
          fontWeight: 500,
          color: colors.muted,
          opacity: interpolate(frame, [2 * fps, 2.6 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        Strategies in the symbol search: list, configure, run, review.
      </div>
    </AbsoluteFill>
  );
};

export const Input = Interactive.create({
  Component: InputInner,
  layout: "absolute-fill",
});
