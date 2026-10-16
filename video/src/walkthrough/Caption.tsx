import type React from "react";
import { Easing, interpolate, spring, useVideoConfig } from "remotion";
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

const EXIT = 6;

const jelly = (frame: number, fps: number) => {
  const width = spring({
    frame,
    fps,
    config: { mass: 0.4, stiffness: 420, damping: 15 },
  });
  const height = spring({
    frame,
    fps,
    delay: 1,
    config: { mass: 0.4, stiffness: 420, damping: 15 },
  });
  return { width, height };
};

const shrink = (frame: number, to: number) =>
  interpolate(frame, [to - EXIT, to - EXIT + 2, to], [1, 1.04, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.5, 0, 0.75, 0),
  });

export const Caption: React.FC<CaptionProps> = ({
  children,
  anchor,
  frame,
  from,
  to,
  side = "right",
}) => {
  const { fps } = useVideoConfig();
  if (frame < from || frame > to) return null;

  const enter = jelly(frame - from, fps);
  const exit = shrink(frame, to);
  const squash = interpolate(frame, [to - EXIT + 2, to], [0, 0.05], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
        scale: `${enter.width * exit * (1 + squash)} ${enter.height * exit * (1 - squash)}`,
        padding: "16px 30px 20px",
        borderRadius: 999,
        background: colors.accent,
        color: "#ffffff",
        fontFamily: sans,
        fontSize: 44,
        fontWeight: 700,
        letterSpacing: "-0.01em",
        whiteSpace: "nowrap",
        textShadow: "0 2px 0 rgb(0 40 110 / 0.35)",
        boxShadow: [
          "inset 0 4px 6px rgb(0 35 100 / 0.35)",
          "inset 0 -6px 0 rgb(0 45 120 / 0.45)",
          "inset 0 -12px 18px rgb(0 40 110 / 0.25)",
        ].join(", "),
      }}
    >
      {children}
    </div>
  );
};
