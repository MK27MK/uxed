export type Rect = { x: number; y: number; width: number; height: number };

export type MockDom = {
  readonly doc: Document;
  readonly win: Window;
  readonly shadow: ShadowRoot;
};

export type Action = {
  readonly frame: number;
  readonly run: (dom: MockDom) => void;
};

const NO_MOTION = "*, *::before, *::after { transition: none !important; caret-color: transparent !important; }";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const settle = async (dom: MockDom) => {
  await new Promise<void>((resolve) => dom.win.requestAnimationFrame(() => resolve()));
  await wait(0);
};

const findShadow = (doc: Document) =>
  [...doc.body.children].find((el) => el.shadowRoot)?.shadowRoot ?? null;

const loadedDom = (iframe: HTMLIFrameElement): MockDom | null => {
  const win = iframe.contentWindow;
  const doc = iframe.contentDocument;
  if (!win || !doc || doc.readyState !== "complete" || !doc.body) return null;
  const shadow = findShadow(doc);
  const counter = shadow?.querySelector(".mk-assumptions")?.textContent ?? "";
  if (!shadow || !counter.includes("assumption")) return null;
  return { doc, win, shadow };
};

const waitForDom = async (iframe: HTMLIFrameElement) => {
  for (let i = 0; i < 400; i += 1) {
    const dom = loadedDom(iframe);
    if (dom) {
      if (!dom.doc.getElementById("walkthrough-no-motion")) {
        const style = dom.doc.createElement("style");
        style.id = "walkthrough-no-motion";
        style.textContent = NO_MOTION;
        dom.doc.head.append(style);
        const shadowStyle = dom.doc.createElement("style");
        shadowStyle.textContent = NO_MOTION;
        dom.shadow.append(shadowStyle);
      }
      await settle(dom);
      return dom;
    }
    await wait(25);
  }
  throw new Error("mock.html did not load in the iframe");
};

export class MockDriver {
  private applied = 0;
  private dom: MockDom | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly iframe: () => HTMLIFrameElement | null,
    private readonly actions: readonly Action[],
  ) {}

  sync<T>(frame: number, work: (dom: MockDom) => Promise<T> | T): Promise<T> {
    const next = this.queue.then(async () => {
      const iframe = this.iframe();
      if (!iframe) throw new Error("iframe is not mounted");
      const target = this.actions.filter((action) => action.frame <= frame).length;
      if (!this.dom || target < this.applied || !loadedDom(iframe)) {
        if (this.dom && target < this.applied) {
          const stale = this.dom.doc;
          iframe.contentWindow?.location.reload();
          while (iframe.contentDocument === stale) await wait(10);
        }
        this.dom = null;
        this.applied = 0;
        this.dom = await waitForDom(iframe);
      }
      const dom = this.dom;
      while (this.applied < target) {
        this.actions[this.applied].run(dom);
        this.applied += 1;
        await settle(dom);
      }
      return work(dom);
    });
    this.queue = next.catch(() => undefined);
    return next;
  }
}

export const rectOf = (el: Element | null | undefined): Rect | null => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { x: r.x, y: r.y, width: r.width, height: r.height };
};

export const q = (dom: MockDom, selector: string) => dom.doc.querySelector(selector);

export const sq = (dom: MockDom, selector: string) => dom.shadow.querySelector(selector);

export const shadowButton = (dom: MockDom, text: string) =>
  [...dom.shadow.querySelectorAll("button")].find((b) => b.textContent?.trim() === text) ?? null;

export const commentsSection = (dom: MockDom) =>
  [...dom.shadow.querySelectorAll(".mk-panel section")].find(
    (section) => section.querySelector("h3")?.textContent?.trim() === "Comments",
  ) ?? null;

export const hoverAt = (dom: MockDom, x: number, y: number) => {
  const target = dom.doc.elementFromPoint(x, y);
  if (!target) return;
  const { PointerEvent } = dom.win as unknown as typeof globalThis;
  const init = { bubbles: true, composed: true, clientX: x, clientY: y };
  target.dispatchEvent(new PointerEvent("pointerover", init));
  target.dispatchEvent(new PointerEvent("pointermove", init));
};
