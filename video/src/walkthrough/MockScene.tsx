import { useEffect, useRef, useState } from "react";
import {
  continueRender,
  delayRender,
  IFrame,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Caption } from "./Caption";
import { Cursor } from "./Cursor";
import {
  cameraAt,
  lerpPoint,
  segmentProgress,
  toScreen,
  worldStyle,
  type Camera,
  type Point,
  type Shot,
} from "./camera";
import {
  commentsSection,
  hoverAt,
  MockDriver,
  q,
  rectOf,
  shadowButton,
  sq,
  type Action,
  type MockDom,
  type Rect,
} from "./mockDriver";

const VIEWPORT = { width: 1536, height: 864 };
const BASE = 1920 / VIEWPORT.width;
const COMMENT = "Make the row taller";

const T = {
  cursorIn: 34,
  tabArrive: 56,
  tabClick: 60,
  inspectArrive: 122,
  inspectClick: 126,
  sweep: [178, 194, 208, 220, 232, 244, 258],
  rowClick: 262,
  scrollFrom: 288,
  scrollTo: 300,
  inputArrive: 306,
  typeFrom: 310,
  typeTo: 330,
  buttonArrive: 340,
  commentClick: 344,
};

const ACTIONS: Action[] = [
  { frame: T.tabClick, run: (dom) => (q(dom, '[data-tab="strategies"]') as HTMLElement).click() },
  { frame: T.inspectClick, run: (dom) => (sq(dom, 'button[title="Inspect"]') as HTMLElement).click() },
  { frame: T.rowClick, run: (dom) => (q(dom, '[data-strategy="bollinger_bands"]') as HTMLElement).click() },
  {
    frame: T.commentClick,
    run: (dom) => {
      const input = sq(dom, 'textarea[aria-label="New comment"]') as HTMLTextAreaElement;
      input.value = COMMENT;
      shadowButton(dom, "Comment")?.click();
    },
  },
];

type View = {
  readonly camera: Camera;
  readonly cursor: Point;
  readonly anchors: Record<string, Point>;
};

const center = (rect: Rect | null): Point | null =>
  rect ? { x: (rect.x + rect.width / 2) * BASE, y: (rect.y + rect.height / 2) * BASE } : null;

const below = (rect: Rect | null): Point | null =>
  rect ? { x: (rect.x + rect.width / 2) * BASE, y: (rect.y + rect.height) * BASE } : null;

const above = (rect: Rect | null): Point | null =>
  rect ? { x: (rect.x + rect.width / 2) * BASE, y: rect.y * BASE } : null;

const FULL: Point = { x: 960, y: 540 };

const targets = (dom: MockDom) => {
  const panel = rectOf(sq(dom, ".mk-panel"));
  const input = rectOf(sq(dom, 'textarea[aria-label="New comment"]'));
  const rows = [...dom.doc.querySelectorAll("[data-strategy]")].map((row) => rectOf(row));
  return {
    tab: rectOf(q(dom, '[data-tab="strategies"]')),
    tabs: rectOf(q(dom, '[data-ui="category-tabs"]')),
    search: rectOf(q(dom, '[data-ui="search-field"]')),
    dialog: rectOf(q(dom, '[data-ui="dialog"]')),
    inspect: rectOf(sq(dom, 'button[title="Inspect"]')),
    toolbar: rectOf(sq(dom, ".mk-modes")),
    rows,
    panelTop: panel ? { ...panel, height: Math.min(panel.height, 560) } : null,
    input,
    inputStart: input ? { ...input, x: input.x + 16, width: 0 } : null,
    button: rectOf(shadowButton(dom, "Comment")),
  };
};

const pathAt = (frame: number, path: readonly { frame: number; at: Point | null }[]) => {
  let current = path[0].at ?? FULL;
  for (let i = 1; i < path.length; i += 1) {
    const next = path[i].at ?? current;
    const t = segmentProgress(frame, path[i - 1].frame, path[i].frame);
    if (t === 0) break;
    current = lerpPoint(current, next, t);
  }
  return current;
};

const measure = (frame: number, dom: MockDom): View => {
  const t = targets(dom);
  const shots: Shot[] = [
    { frame: 0, focus: FULL, zoom: 1 },
    { frame: 54, travel: 24, focus: center(t.tabs) ?? FULL, zoom: 1.9 },
    { frame: 122, travel: 22, focus: center(t.toolbar) ?? FULL, zoom: 2.2 },
    { frame: 164, travel: 24, focus: center(t.dialog) ?? FULL, zoom: 1.15 },
    { frame: 286, travel: 24, focus: center(t.panelTop) ?? FULL, zoom: 1.6 },
    { frame: 308, travel: 18, focus: center(t.input) ?? center(t.panelTop) ?? FULL, zoom: 1.75 },
    { frame: 358, travel: 14, focus: FULL, zoom: 1 },
  ];
  const camera = cameraAt(frame, shots, 20);
  const row = (i: number) => center(t.rows[i] ?? null);
  const world = pathAt(frame, [
    { frame: T.cursorIn, at: { x: 1180, y: 860 } },
    { frame: T.tabArrive, at: center(t.tab) },
    { frame: 100, at: center(t.tab) },
    { frame: T.inspectArrive, at: center(t.inspect) },
    { frame: 160, at: center(t.inspect) },
    { frame: T.sweep[0], at: center(t.search) },
    { frame: T.sweep[1], at: center(t.tabs) },
    { frame: T.sweep[2], at: row(0) },
    { frame: T.sweep[3], at: row(1) },
    { frame: T.sweep[4], at: row(2) },
    { frame: T.sweep[5], at: row(3) },
    { frame: T.sweep[6], at: row(0) },
    { frame: 290, at: row(0) },
    { frame: T.inputArrive, at: center(t.inputStart) },
    { frame: T.typeTo + 2, at: center(t.inputStart) },
    { frame: T.buttonArrive, at: center(t.button) },
  ]);
  const { width, height } = { width: 1920, height: 1080 };
  const screen = (p: Point | null) => (p ? toScreen(p, camera, width, height) : toScreen(FULL, camera, width, height));
  return {
    camera,
    cursor: screen(world),
    anchors: {
      tab: screen(below(t.tab)),
      inspect: screen(below(t.inspect)),
      input: screen(above(t.input)),
    },
  };
};

const applyContinuous = (frame: number, dom: MockDom) => {
  const panel = sq(dom, ".mk-panel") as HTMLElement | null;
  const comments = commentsSection(dom) as HTMLElement | null;
  if (panel && comments && frame >= T.scrollFrom) {
    const end = Math.min(comments.offsetTop - 24, panel.scrollHeight - panel.clientHeight);
    panel.scrollTop = end * segmentProgress(frame, T.scrollFrom, T.scrollTo);
  }
  const input = sq(dom, 'textarea[aria-label="New comment"]') as HTMLTextAreaElement | null;
  if (input && frame < T.commentClick) {
    const chars = Math.round(interpolate(frame, [T.typeFrom, T.typeTo], [0, COMMENT.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
    input.value = COMMENT.slice(0, chars);
  }
};

const MockSceneInner = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const driverRef = useRef<MockDriver | null>(null);
  const [view, setView] = useState<(View & { frame: number }) | null>(null);
  const pending = useRef(new Map<number, number>());

  driverRef.current ??= new MockDriver(() => iframeRef.current, ACTIONS);

  useEffect(() => {
    if (!view) return;
    const handle = pending.current.get(view.frame);
    if (handle === undefined) return;
    pending.current.delete(view.frame);
    continueRender(handle);
  }, [view]);

  useEffect(() => {
    const handle = delayRender(`Mock frame ${frame}`, { timeoutInMilliseconds: 30000 });
    pending.current.set(frame, handle);
    driverRef.current!
      .sync(frame, async (dom) => {
        applyContinuous(frame, dom);
        const next = measure(frame, dom);
        if (frame >= T.inspectClick) {
          const { focus, zoom } = next.camera;
          hoverAt(
            dom,
            (focus.x + (next.cursor.x - width / 2) / zoom) / BASE,
            (focus.y + (next.cursor.y - height / 2) / zoom) / BASE,
          );
        }
        setView({ ...next, frame });
      })
      .catch((error: unknown) => {
        console.error(error);
        pending.current.delete(frame);
        continueRender(handle);
      });
  }, [frame, width, height]);

  const camera = view?.camera ?? { focus: FULL, zoom: 1 };
  const anchors = view?.anchors ?? {};

  return (
    <>
      <div style={worldStyle(camera, width, height)}>
        <div style={{ width: VIEWPORT.width, height: VIEWPORT.height, scale: String(BASE), transformOrigin: "0 0" }}>
          <IFrame
            ref={iframeRef}
            src={staticFile("walkthrough/mock.html")}
            style={{ width: VIEWPORT.width, height: VIEWPORT.height, border: 0, display: "block" }}
          />
        </div>
      </div>

      {anchors.tab ? (
        <Caption anchor={anchors.tab} frame={frame} from={T.tabClick + 2} to={100} side="below">
          Interact with it
        </Caption>
      ) : null}
      {anchors.inspect ? (
        <Caption anchor={anchors.inspect} frame={frame} from={T.inspectClick + 2} to={158} side="below">
          Inspect
        </Caption>
      ) : null}
      <Caption anchor={{ x: width / 2, y: 890 }} frame={frame} from={T.sweep[0] - 4} to={T.sweep[6]} side="below">
        Every element, named as in code
      </Caption>
      {anchors.input ? (
        <Caption anchor={anchors.input} frame={frame} from={T.inputArrive} to={T.commentClick + 2} side="above">
          Comment on it
        </Caption>
      ) : null}

      {view ? (
        <Cursor
          position={view.cursor}
          frame={frame}
          clicks={[T.tabClick, T.inspectClick, T.rowClick, T.inputArrive + 2, T.commentClick]}
          visible={frame >= T.cursorIn}
        />
      ) : null}
    </>
  );
};

export const MockScene = Interactive.create({
  Component: MockSceneInner,
  layout: "absolute-fill",
});
