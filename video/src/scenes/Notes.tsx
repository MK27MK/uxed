import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, mono, sans } from "../theme";
import { Eyebrow } from "./Eyebrow";

const NotesInner = () => {
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
      <Eyebrow>Behaviour notes</Eyebrow>
      <div
        style={{
          fontSize: 88,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: colors.foreground,
        }}
      >
        Every element gets its rules
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 120,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            opacity: interpolate(frame, [0.3 * fps, 0.9 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <div style={{ fontSize: 200, fontWeight: 800, color: colors.foreground, lineHeight: 1 }}>
            {Math.round(
              interpolate(frame, [0.3 * fps, 1.6 * fps], [0, 51], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
            )}
          </div>
          <div style={{ fontSize: 48, color: colors.muted }}>behaviour rules</div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            opacity: interpolate(frame, [0.6 * fps, 1.2 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <div style={{ fontSize: 200, fontWeight: 800, color: colors.foreground, lineHeight: 1 }}>
            18
          </div>
          <div style={{ fontSize: 48, color: colors.muted }}>elements</div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            opacity: interpolate(frame, [0.9 * fps, 1.5 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <div style={{ fontSize: 200, fontWeight: 800, color: "#f5b83d", lineHeight: 1 }}>
            4
          </div>
          <div style={{ fontSize: 48, color: colors.muted }}>assumptions to confirm</div>
        </div>
      </div>
      <div
        style={{
          fontFamily: mono,
          fontSize: 34,
          color: colors.muted,
          opacity: interpolate(frame, [1.8 * fps, 2.4 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        &quot;sort by ending time of the run / final P&amp;L&quot; — from the margin of sketch 3
      </div>
    </AbsoluteFill>
  );
};

export const Notes = Interactive.create({
  Component: NotesInner,
  layout: "absolute-fill",
});
