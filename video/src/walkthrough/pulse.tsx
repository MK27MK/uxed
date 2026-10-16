import type { TransitionPresentationComponentProps } from "@remotion/transitions";
import { Easing, interpolate } from "remotion";
import { colors } from "../theme";

export const PulsePresentation = ({
  children,
  presentationDirection,
  presentationProgress,
}: TransitionPresentationComponentProps<Record<string, never>>) => {
  const p = Easing.bezier(0.33, 0, 0.2, 1)(presentationProgress);

  if (presentationDirection === "exiting") {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          scale: String(interpolate(p, [0, 1], [1, 1.08])),
          opacity: interpolate(p, [0, 0.6], [1, 0], { extrapolateRight: "clamp" }),
        }}
      >
        {children}
      </div>
    );
  }

  const radius = interpolate(p, [0, 1], [0, 120]);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath: `circle(${radius}% at 50% 50%)`,
          scale: String(interpolate(p, [0, 1], [0.94, 1])),
        }}
      >
        {children}
      </div>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: `${radius * 2 * 11}px`,
          height: `${radius * 2 * 11}px`,
          translate: "-50% -50%",
          borderRadius: "50%",
          border: `6px solid ${colors.accent}`,
          opacity: interpolate(p, [0, 0.2, 1], [0, 0.9, 0]),
          boxShadow: `0 0 60px ${colors.accent}`,
        }}
      />
    </div>
  );
};
