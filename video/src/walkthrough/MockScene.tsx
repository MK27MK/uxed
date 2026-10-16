import { useEffect, useRef, useState } from "react";
import {
  continueRender,
  delayRender,
  Easing,
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
const REPLY = "Raised the row padding from 7px to 16px.";

const T = {
  cursorIn: 38,
  tabArrive: 64,
  tabClick: 68,
  interactUntil: 104,
  inspectArrive: 130,
  inspectClick: 134,
  inspectUntil: 168,
  sweep: [190, 206, 222],
  rowClick: 226,
  panelWide: 250,
  rulesArrive: 262,
  rulesClose: 280,
  scrollFrom: 298,
  scrollTo: 320,
  inputArrive: 334,
  typeFrom: 340,
  typeTo: 368,
  buttonArrive: 380,
  commentClick: 386,
  cursorOut: 410,
  agentReply: 416,
  wideArrive: 470,
  growFrom: 466,
  growTo: 492,
  appliedUntil: 530,
};

const CLICKS = [T.tabClick, T.inspectClick, T.rowClick, T.inputArrive + 2, T.commentClick];

const ROW_PADDING = { from: 7, to: 16 };

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
  { frame: T.agentReply, run: (dom) => shadowButton(dom, "Resolve")?.click() },
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

const FULL: Point = { x: 960, y: 540 };
const PANEL_TOP: Rect = { x: VIEWPORT.width - 320, y: 0, width: 320, height: 560 };

const scrollEnd = (panel: HTMLElement, comments: HTMLElement) =>
  Math.min(comments.offsetTop - 24, panel.scrollHeight - panel.clientHeight);

const union = (a: Rect | null, b: Rect | null): Rect | null => {
  if (!a || !b) return a ?? b;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
};

const fit = (rect: Rect | null) =>
  rect ? Math.min(1920 / (rect.width * BASE * 1.1), 1080 / (rect.height * BASE * 1.15)) : 1;

const insideFrame = ({ focus, zoom }: Camera): Camera => {
  const halfWidth = 960 / zoom;
  const halfHeight = 540 / zoom;
  return {
    zoom,
    focus: {
      x: Math.min(Math.max(focus.x, halfWidth), 1920 - halfWidth),
      y: Math.min(Math.max(focus.y, halfHeight), 1080 - halfHeight),
    },
  };
};

const targets = (dom: MockDom) => {
  const panel = sq(dom, ".mk-panel") as HTMLElement | null;
  const comments = commentsSection(dom) as HTMLElement | null;
  const scrollLeft = panel && comments ? scrollEnd(panel, comments) - panel.scrollTop : 0;
  const posted = rectOf(sq(dom, ".mk-panel .mk-comment"));
  const shift = posted ? posted.height + 8 : 0;
  const lift = (rect: Rect | null) => (rect ? { ...rect, y: rect.y - shift } : null);
  const input = lift(rectOf(sq(dom, 'textarea[aria-label="New comment"]')));
  const heading = rectOf(comments?.querySelector("h3"));
  const rows = [...dom.doc.querySelectorAll("[data-strategy]")].map((row) => rectOf(row));
  return {
    tab: rectOf(q(dom, '[data-tab="strategies"]')),
    tabs: rectOf(q(dom, '[data-ui="category-tabs"]')),
    search: rectOf(q(dom, '[data-ui="search-field"]')),
    dialog: rectOf(q(dom, '[data-ui="dialog"]')),
    inspect: rectOf(sq(dom, 'button[title="Inspect"]')),
    toolbar: rectOf(sq(dom, ".mk-modes")),
    rows,
    list: rectOf(q(dom, "#strategy-list")),
    panelTop: PANEL_TOP,
    input,
    inputStart: input ? { ...input, x: input.x + 16, width: 0 } : null,
    comments: input && heading ? { ...input, y: heading.y - scrollLeft, height: 150 } : null,
    button: lift(rectOf(shadowButton(dom, "Comment"))),
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
    { frame: 62, travel: 28, focus: center(t.tabs) ?? FULL, zoom: 1.9 },
    { frame: T.inspectArrive, travel: 26, focus: center(t.toolbar) ?? FULL, zoom: 2.2 },
    { frame: 182, travel: 26, focus: center(t.dialog) ?? FULL, zoom: 1.15 },
    { frame: T.panelWide, travel: 34, focus: center(union(t.dialog, t.panelTop)) ?? FULL, zoom: fit(union(t.dialog, t.panelTop)) },
    { frame: T.rulesClose + 4, travel: 30, focus: center(t.panelTop) ?? FULL, zoom: 1.5 },
    { frame: T.inputArrive + 4, travel: 40, focus: center(t.comments) ?? center(t.panelTop) ?? FULL, zoom: 1.75 },
    { frame: T.wideArrive + 4, travel: 40, focus: center(union(t.dialog, t.panelTop)) ?? FULL, zoom: fit(union(t.dialog, t.panelTop)) },
  ];
  const camera = insideFrame(cameraAt(frame, shots, 20));
  const row = (i: number) => center(t.rows[i] ?? null);
  const world = pathAt(frame, [
    { frame: T.cursorIn, at: { x: 1180, y: 860 } },
    { frame: T.tabArrive, at: center(t.tab) },
    { frame: T.interactUntil, at: center(t.tab) },
    { frame: T.inspectArrive, at: center(t.inspect) },
    { frame: T.inspectUntil + 4, at: center(t.inspect) },
    { frame: T.sweep[0], at: center(t.search) },
    { frame: T.sweep[1], at: center(t.tabs) },
    { frame: T.sweep[2], at: row(0) },
    { frame: T.rowClick + 4, at: row(0) },
    { frame: T.rulesArrive, at: center(t.panelTop) },
    { frame: T.scrollTo, at: center(t.panelTop) },
    { frame: T.inputArrive, at: center(t.inputStart) },
    { frame: T.typeTo + 2, at: center(t.inputStart) },
    { frame: T.buttonArrive, at: center(t.button) },
    { frame: T.commentClick + 4, at: center(t.button) },
    { frame: T.cursorOut, at: { x: 2100, y: 1300 } },
  ]);
  const { width, height } = { width: 1920, height: 1080 };
  const screen = (p: Point | null) => (p ? toScreen(p, camera, width, height) : toScreen(FULL, camera, width, height));
  return {
    camera,
    cursor: screen(world),
    anchors: {
      tab: screen(below(t.tab)),
      inspect: screen(below(t.inspect)),
      rules: screen(t.panelTop ? { x: t.panelTop.x * BASE, y: (t.panelTop.y + t.panelTop.height / 2) * BASE } : null),
      input: screen(t.input ? { x: t.input.x * BASE, y: (t.input.y + t.input.height / 2) * BASE } : null),
      list: screen(below(t.rows[t.rows.length - 1] ?? null)),
    },
  };
};

const addAgentReply = (dom: MockDom) => {
  const comment = sq(dom, ".mk-panel .mk-comment");
  if (!comment || sq(dom, "#walkthrough-reply")) return;
  const reply = comment.cloneNode(true) as HTMLElement;
  reply.id = "walkthrough-reply";
  reply.dataset.resolved = "false";
  reply.querySelectorAll("button").forEach((button) => button.remove());
  reply.querySelector("strong")!.textContent = "Agent";
  reply.querySelector("p")!.textContent = REPLY;
  comment.after(reply);
};

const styleIn = (dom: MockDom, root: Document | ShadowRoot, id: string) => {
  let style = root.getElementById(id);
  if (!style) {
    style = dom.doc.createElement("style");
    style.id = id;
    (root === dom.doc ? dom.doc.head : root).append(style);
  }
  return style;
};

const slidePanel = (frame: number, dom: MockDom) => {
  const open = segmentProgress(frame, T.rowClick, T.rowClick + 18);
  styleIn(dom, dom.doc, "walkthrough-page").textContent =
    `html.mk-has-panel body { margin-right: ${open * 320}px !important; }`;
  styleIn(dom, dom.shadow, "walkthrough-panel").textContent =
    `.mk-panel { translate: ${(1 - open) * 320}px 0; }`;
};

const reposition = (dom: MockDom) => {
  const { Event } = dom.win as unknown as typeof globalThis;
  dom.win.dispatchEvent(new Event("scroll"));
};

const applyContinuous = (frame: number, dom: MockDom) => {
  slidePanel(frame, dom);
  const rowStyle = styleIn(dom, dom.doc, "walkthrough-rows");
  const padding = interpolate(frame, [T.growFrom, T.growTo], [ROW_PADDING.from, ROW_PADDING.to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.65, 0, 0.35, 1),
  });
  rowStyle.textContent = `#strategy-list .item { padding-block: ${padding}px; }`;
  if (frame >= T.growFrom) {
    for (const side of ["top", "bottom"]) {
      const field = sq(dom, `#mk-padding-${side}`) as HTMLInputElement | null;
      if (field) field.value = `${Math.round(padding)}px`;
    }
    const height = sq(dom, "#mk-height") as HTMLInputElement | null;
    if (height) height.value = `${Math.round(32 + 2 * (padding - ROW_PADDING.from))}px`;
  }

  const panel = sq(dom, ".mk-panel") as HTMLElement | null;
  const comments = commentsSection(dom) as HTMLElement | null;
  if (panel && comments && frame >= T.scrollFrom) {
    panel.scrollTop = scrollEnd(panel, comments) * segmentProgress(frame, T.scrollFrom, T.scrollTo);
  }
  if (frame >= T.agentReply) addAgentReply(dom);

  const input = sq(dom, 'textarea[aria-label="New comment"]') as HTMLTextAreaElement | null;
  if (input && frame < T.commentClick) {
    const chars = Math.round(interpolate(frame, [T.typeFrom, T.typeTo], [0, COMMENT.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
    input.value = COMMENT.slice(0, chars);
  }
  reposition(dom);
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
        if (frame >= T.inspectClick && frame < T.commentClick) {
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
        <Caption anchor={anchors.tab} frame={frame} from={T.tabClick + 2} to={T.interactUntil} side="below">
          Interact with it
        </Caption>
      ) : null}
      {anchors.inspect ? (
        <Caption anchor={anchors.inspect} frame={frame} from={T.inspectClick + 2} to={T.inspectUntil} side="below">
          Inspect
        </Caption>
      ) : null}
      <Caption anchor={{ x: width / 2, y: 890 }} frame={frame} from={T.sweep[0] - 4} to={T.rowClick} side="below">
        Every element, named as in code
      </Caption>
      {anchors.rules ? (
        <Caption anchor={anchors.rules} frame={frame} from={T.panelWide} to={T.scrollFrom + 2} side="left">
          Behaviour, written as rules
        </Caption>
      ) : null}
      {anchors.input ? (
        <Caption anchor={anchors.input} frame={frame} from={T.inputArrive} to={T.commentClick + 4} side="left">
          Comment on it
        </Caption>
      ) : null}
      {anchors.list ? (
        <Caption anchor={anchors.list} frame={frame} from={T.growFrom} to={T.appliedUntil} side="below">
          The agent applies it
        </Caption>
      ) : null}

      {view ? (
        <Cursor
          position={view.cursor}
          frame={frame}
          clicks={CLICKS}
          visible={frame >= T.cursorIn && frame < T.cursorOut}
        />
      ) : null}
    </>
  );
};

export const MockScene = Interactive.create({
  Component: MockSceneInner,
  layout: "absolute-fill",
});
