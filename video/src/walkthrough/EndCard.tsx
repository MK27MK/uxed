import { Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { colors, mono, sans } from "../theme";
import { Logo } from "./Logo";

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
  const drawn = interpolate(frame, [2, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.65, 0, 0.35, 1),
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
        <Logo size={200} drawn={drawn} style={{ marginBottom: 24 }} />
        <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: "-0.03em", ...rise(16) }}>
          Sketch <span style={{ color: colors.accent }}>→</span> mock <span style={{ color: colors.accent }}>→</span> code
        </div>
        <div style={{ marginTop: -20, fontSize: 64, fontWeight: 700, color: colors.muted, ...rise(22) }}>
          in 5 minutes
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
            ...rise(30),
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
