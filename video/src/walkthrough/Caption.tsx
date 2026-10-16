import type React from "react";
import { Easing, interpolate } from "remotion";
import { colors, sans } from "../theme";
import type { Point } from "./camera";

type CaptionProps = {
  readonly children: React.ReactNode;
  readonly anchor: Point;
  readonly frame: number;
  readonly from: number;
  readonly to: number;
  readonly side?: "right" | "below" | "left" | "above";
};

export const Caption: React.FC<CaptionProps> = ({
  children,
  anchor,
  frame,
  from,
  to,
  side = "right",
}) => {
  const enter = interpolate(frame, [from, from + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const exit = interpolate(frame, [to - 6, to], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (frame < from || frame > to) return null;

  const offset = {
    right: { translate: "28px -50%", origin: "0% 50%" },
    left: { translate: "calc(-100% - 28px) -50%", origin: "100% 50%" },
    below: { translate: "-50% 28px", origin: "50% 0%" },
    above: { translate: "-50% calc(-100% - 28px)", origin: "50% 100%" },
  }[side];

  return (
    <div
      style={{
        position: "absolute",
        left: anchor.x,
        top: anchor.y,
        translate: offset.translate,
        transformOrigin: offset.origin,
        scale: String(0.85 + 0.15 * enter),
        opacity: Math.min(enter, exit),
        padding: "16px 28px",
        borderRadius: 999,
        background: colors.accent,
        color: "#ffffff",
        fontFamily: sans,
        fontSize: 44,
        fontWeight: 700,
        letterSpacing: "-0.01em",
        whiteSpace: "nowrap",
        boxShadow: "0 12px 40px rgb(0 0 0 / 0.45)",
      }}
    >
      {children}
    </div>
  );
};
