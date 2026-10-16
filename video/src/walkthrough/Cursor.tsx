import type React from "react";
import { interpolate } from "remotion";
import type { Point } from "./camera";

type CursorProps = {
  readonly position: Point;
  readonly frame: number;
  readonly clicks: readonly number[];
  readonly visible?: boolean;
};

export const Cursor: React.FC<CursorProps> = ({
  position,
  frame,
  clicks,
  visible = true,
}) => {
  const press = Math.max(
    0,
    ...clicks.map((click) =>
      interpolate(frame, [click - 3, click, click + 5], [0, 1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    ),
  );
  const ripple = clicks
    .map((click) => frame - click)
    .filter((age) => age >= 0 && age < 14)
    .pop();

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        opacity: visible ? 1 : 0,
        pointerEvents: "none",
      }}
    >
      {ripple !== undefined ? (
        <div
          style={{
            position: "absolute",
            left: -36,
            top: -36,
            width: 72,
            height: 72,
            borderRadius: "50%",
            border: "3px solid rgb(61 155 255 / 0.9)",
            scale: String(interpolate(ripple, [0, 14], [0.3, 1.2])),
            opacity: interpolate(ripple, [0, 14], [1, 0]),
          }}
        />
      ) : null}
      <svg
        width="44"
        height="52"
        viewBox="0 0 22 26"
        style={{
          position: "absolute",
          left: -3,
          top: -2,
          scale: String(1 - press * 0.15),
          transformOrigin: "3px 2px",
          filter: "drop-shadow(0 3px 6px rgb(0 0 0 / 0.45))",
        }}
      >
        <path
          d="M3 2 L3 20 L8 15.5 L11.5 23.5 L14.6 22.1 L11.2 14.3 L18 14 Z"
          fill="#ffffff"
          stroke="#111111"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
