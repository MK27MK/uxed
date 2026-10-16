import { Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { colors, mono, sans } from "../theme";

const EndCardInner = () => {
  const frame = useCurrentFrame();
  const rise = (from: number) => ({
    opacity: interpolate(frame, [from, from + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    translate: interpolate(frame, [from, from + 14], ["0px 30px", "0px 0px"], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    }),
  });

  return (
    <>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 44,
          fontFamily: sans,
          color: colors.foreground,
        }}
      >
        <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: "-0.03em", ...rise(4) }}>
          Sketch <span style={{ color: colors.accent }}>→</span> mock in 2:30
        </div>
        <div
          style={{
            fontFamily: mono,
            fontSize: 46,
            color: colors.muted,
            padding: "18px 36px",
            borderRadius: 18,
            border: `1px solid ${colors.line}`,
            background: "#11161e",
            ...rise(14),
          }}
        >
          npx skills add MK27MK/uxed
        </div>
      </div>
    </>
  );
};

export const EndCard = Interactive.create({
  Component: EndCardInner,
  layout: "absolute-fill",
});
