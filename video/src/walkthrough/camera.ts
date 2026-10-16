import { Easing, interpolate } from "remotion";

export type Point = { readonly x: number; readonly y: number };

export type Shot = {
  readonly frame: number;
  readonly focus: Point;
  readonly zoom: number;
  readonly travel?: number;
};

export type Camera = { readonly focus: Point; readonly zoom: number };

const ease = Easing.bezier(0.65, 0, 0.35, 1);

export const lerpPoint = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

export const segmentProgress = (
  frame: number,
  from: number,
  to: number,
  easing = ease,
) =>
  interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

export const cameraAt = (
  frame: number,
  shots: readonly Shot[],
  travel: number,
): Camera => {
  let current: Camera = shots[0];
  for (const shot of shots.slice(1)) {
    const t = segmentProgress(frame, shot.frame - (shot.travel ?? travel), shot.frame);
    if (t === 0) break;
    const zoom = Math.exp(
      Math.log(current.zoom) + (Math.log(shot.zoom) - Math.log(current.zoom)) * t,
    );
    current = { focus: lerpPoint(current.focus, shot.focus, t), zoom };
  }
  return current;
};

export const toScreen = (
  point: Point,
  camera: Camera,
  width: number,
  height: number,
): Point => ({
  x: width / 2 + (point.x - camera.focus.x) * camera.zoom,
  y: height / 2 + (point.y - camera.focus.y) * camera.zoom,
});

export const worldStyle = (
  camera: Camera,
  width: number,
  height: number,
): React.CSSProperties => ({
  position: "absolute",
  left: 0,
  top: 0,
  transformOrigin: "0 0",
  translate: `${width / 2 - camera.focus.x * camera.zoom}px ${height / 2 - camera.focus.y * camera.zoom}px`,
  scale: String(camera.zoom),
});
