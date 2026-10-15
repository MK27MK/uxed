(() => {
  const NOTES_URL = "/__mock/notes";
  const EVENTS_URL = "/__mock/events";
  const MODE_KEY = "mk-mode";
  const PANEL_WIDTH_PX = 320;
  const AUTOSAVE_DELAY_MS = 600;
  const TOAST_MS = 2400;
  const FONT_WEIGHTS = ["100", "200", "300", "400", "500", "600", "700", "800", "900"];
  const STYLE_GROUPS = [
    { title: "Layout", controls: [["width", "length"], ["height", "length"], ["gap", "length"]] },
    {
      title: "Padding",
      controls: [
        ["padding-top", "length", "top"],
        ["padding-right", "length", "right"],
        ["padding-bottom", "length", "bottom"],
        ["padding-left", "length", "left"],
      ],
    },
    {
      title: "Text",
      controls: [
        ["color", "color"],
        ["font-size", "length"],
        ["font-weight", "select", FONT_WEIGHTS],
        ["line-height", "length"],
        ["letter-spacing", "length"],
        ["text-align", "select", ["left", "center", "right", "justify"]],
      ],
    },
    { title: "Fill", controls: [["background-color", "color", "color"]] },
    {
      title: "Stroke",
      controls: [
        ["border-color", "color", "color"],
        ["border-width", "length", "width"],
        ["border-style", "select", ["none", "solid", "dashed", "dotted"], "style"],
      ],
    },
    { title: "Corners & effects", controls: [["border-radius", "length", "radius"], ["opacity", "number"]] },
  ];
  const STEP = { length: 1, number: 0.01 };
  const BIG_STEP_FACTOR = 10;
  const SMALL_STEP_FACTOR = 0.1;
  const SCRUB_PX_PER_STEP = 2;
  const COLOR_FORMATS = ["hex", "rgb", "hsl"];
  const NAME_PATTERN = /^[A-Za-z_][\w-]*$/;

  const ICON_CURSOR =
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 2.5l9 4.2-4 1.3-1.3 4z"/></svg>';
  const ICON_TARGET =
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="4.5"/><path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3"/></svg>';

  const ICON_DISK =
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 2.5h9l2 2v9h-11z"/><path d="M5 2.5v3h5v-3"/><path d="M4.5 13.5V9.5h7v4"/></svg>';

  const SHELL_CSS = `
    .mk-chrome, .mk-chrome * { box-sizing: border-box; font: 12px/1.4 system-ui, -apple-system, sans-serif; }
    .mk-chrome button, .mk-chrome textarea, .mk-chrome input { color: inherit; }
    .mk-bar { position: fixed; z-index: 2147483000; top: 12px; display: flex; gap: 2px; padding: 3px; border: 1px solid #383838; border-radius: 10px; background: #1e1e1e; color: #e5e5e5; box-shadow: 0 6px 20px rgb(0 0 0 / 0.35); }
    .mk-modes { left: 50%; transform: translateX(-50%); }
    .mk-title { left: 12px; align-items: center; }
    .mk-title h1 { margin: 0; padding: 4px 8px; border-radius: 6px; font: 600 13px/1.4 ui-monospace, monospace; outline: none; cursor: text; }
    .mk-title h1:hover { background: #2c2c2c; }
    .mk-title h1:focus { background: #2c2c2c; box-shadow: inset 0 0 0 1px #0d99ff; }
    .mk-save { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; color: #a0a0a0; }
    .mk-save[data-state="saving"] { color: #0d99ff; animation: mk-pulse 0.8s ease-in-out infinite alternate; }
    .mk-save[data-state="error"] { color: #ff8a80; }
    @keyframes mk-pulse { to { opacity: 0.35; } }
    .mk-assumptions { right: 12px; align-items: center; transition: right 120ms; }
    html.mk-has-panel .mk-assumptions { right: ${PANEL_WIDTH_PX + 12}px; }
    .mk-help { top: auto; bottom: 12px; left: 12px; }
    .mk-help button { font-weight: 700; }
    .mk-help-card { position: fixed; z-index: 2147483000; left: 12px; bottom: 60px; width: 300px; padding: 12px 12px 12px 28px; border: 1px solid #383838; border-radius: 10px; background: #1e1e1e; color: #e5e5e5; box-shadow: 0 6px 20px rgb(0 0 0 / 0.35); }
    .mk-help-card ul { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; }
    .mk-assumptions .mk-count { gap: 6px; }
    .mk-dot { width: 8px; height: 8px; border-radius: 50%; background: #f2a63b; }
    .mk-assumptions[data-empty="true"] .mk-dot { background: #3fb950; }
    .mk-bar button:disabled { opacity: 0.4; cursor: default; background: transparent; }
    .mk-rules { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
    .mk-rule { display: grid; grid-template-columns: 20px minmax(0, 1fr) auto; align-items: start; gap: 6px; padding: 4px; border-radius: 6px; }
    .mk-rule[data-current="true"] { background: #2c2c2c; }
    .mk-badge { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; margin-top: 3px; border-radius: 50%; background: #3fb950; color: #111; font-size: 10px; font-weight: 700; }
    .mk-rule[data-source="assumption"] .mk-badge { background: #f2a63b; }
    .mk-panel .mk-rule textarea { min-height: 26px; field-sizing: content; resize: none; font-family: inherit; font-size: 12px; }
    .mk-rule[data-source="assumption"] textarea { border-color: #6b4e1f; }
    .mk-rule-actions { display: flex; gap: 2px; margin-top: 3px; }
    .mk-panel .mk-confirm { color: #3fb950; font-weight: 700; opacity: 1; }
    .mk-panel .mk-add { align-self: flex-start; padding: 2px 4px; border: 0; background: none; color: #0d99ff; cursor: pointer; }
    .mk-bar button { display: inline-flex; align-items: center; justify-content: center; min-width: 32px; height: 32px; padding: 0 8px; border: 0; border-radius: 7px; background: transparent; cursor: pointer; }
    .mk-bar button:hover { background: #2c2c2c; }
    .mk-bar button[aria-pressed="true"] { background: #0d99ff; color: #fff; }
    .mk-box { position: fixed; z-index: 2147482990; pointer-events: none; display: none; border: 1px solid #0d99ff; }
    .mk-box[data-kind="selected"] { border-width: 2px; }
    .mk-box span { position: absolute; top: -20px; left: -1px; padding: 1px 6px; border-radius: 4px 4px 4px 0; background: #0d99ff; color: #fff; white-space: nowrap; font-size: 11px; }
    html.mk-inspect [data-mock-root] [data-ui] { outline: 1px dashed rgb(13 153 255 / 0.35); outline-offset: 1px; }
    html.mk-inspect [data-mock-root] [data-mk-open] { outline: 1px dashed #f2a63b; }
    html.mk-inspect [data-mock-root], html.mk-inspect [data-mock-root] * { cursor: default !important; }
    html.mk-has-panel body { margin-right: ${PANEL_WIDTH_PX}px; }
    .mk-panel { position: fixed; z-index: 2147483000; top: 0; right: 0; bottom: 0; width: ${PANEL_WIDTH_PX}px; overflow-y: auto; border-left: 1px solid #383838; background: #1e1e1e; color: #e5e5e5; }
    .mk-panel header { display: flex; align-items: center; gap: 8px; padding: 12px; border-bottom: 1px solid #383838; }
    .mk-panel header .mk-name { flex: 1; min-width: 0; padding: 4px 6px; border-color: transparent; background: transparent; font-size: 12px; font-weight: 600; }
    .mk-panel header .mk-name:hover { border-color: #383838; }
    .mk-panel header button { margin-left: auto; width: 28px; height: 28px; border: 0; border-radius: 6px; background: transparent; cursor: pointer; }
    .mk-panel header button:hover { background: #2c2c2c; }
    .mk-panel section { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-bottom: 1px solid #2c2c2c; }
    .mk-panel h3 { margin: 0; color: #a0a0a0; font-size: 11px; font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase; }
    .mk-panel textarea, .mk-panel input { width: 100%; padding: 6px 8px; border: 1px solid #383838; border-radius: 6px; background: #2c2c2c; font-family: ui-monospace, monospace; font-size: 11px; resize: vertical; }
    .mk-panel textarea:focus, .mk-panel input:focus { outline: 1px solid #0d99ff; border-color: #0d99ff; }
    .mk-muted { color: #a0a0a0; }
    .mk-grid { display: grid; grid-template-columns: 104px minmax(0, 1fr); align-items: center; gap: 6px 8px; }
    .mk-comment { display: flex; flex-direction: column; gap: 4px; padding: 8px; border-radius: 6px; background: #2c2c2c; }
    .mk-comment[data-resolved="true"] { opacity: 0.5; }
    .mk-comment div { display: flex; align-items: center; gap: 8px; }
    .mk-comment div strong { margin-right: auto; }
    .mk-panel .mk-icon { padding: 0 2px; border: 0; border-radius: 4px; background: none; cursor: pointer; opacity: 0.6; }
    .mk-panel .mk-icon:hover { opacity: 1; background: #383838; }
    .mk-group { display: flex; flex-direction: column; gap: 6px; }
    .mk-group h4 { margin: 4px 0 0; color: #e5e5e5; font-size: 11px; font-weight: 600; }
    .mk-row { display: grid; grid-template-columns: 76px minmax(0, 1fr) 18px; align-items: center; gap: 6px; }
    .mk-row label { color: #a0a0a0; cursor: ew-resize; user-select: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mk-row label[data-kind="select"], .mk-row label[data-kind="color"] { cursor: default; }
    .mk-row[data-edited="true"] label { color: #0d99ff; }
    .mk-row .mk-icon { visibility: hidden; }
    .mk-row[data-edited="true"] .mk-icon { visibility: visible; }
    .mk-panel select { width: 100%; padding: 5px 6px; border: 1px solid #383838; border-radius: 6px; background: #2c2c2c; font-family: ui-monospace, monospace; font-size: 11px; color: inherit; }
    .mk-color { display: flex; align-items: center; gap: 4px; min-width: 0; }
    .mk-panel .mk-color input[type="color"] { flex: 0 0 22px; width: 22px; height: 22px; padding: 0; border: 1px solid #383838; border-radius: 4px; background: none; cursor: pointer; }
    .mk-panel .mk-color input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
    .mk-panel .mk-color input[type="color"]::-webkit-color-swatch { border: 0; border-radius: 3px; }
    .mk-panel .mk-color .mk-color-text { flex: 1; min-width: 0; }
    .mk-panel .mk-color .mk-alpha { flex: 0 0 46px; }
    .mk-formats { display: flex; gap: 2px; align-self: flex-start; padding: 2px; border-radius: 6px; background: #2c2c2c; }
    .mk-panel .mk-formats button { padding: 2px 8px; border: 0; border-radius: 4px; background: none; cursor: pointer; font-size: 10px; text-transform: uppercase; }
    .mk-panel .mk-formats button[aria-pressed="true"] { background: #0d99ff; color: #fff; }
    .mk-comment p { margin: 0; white-space: pre-wrap; }
    .mk-panel .mk-link { padding: 0; border: 0; background: none; color: #0d99ff; cursor: pointer; }
    .mk-panel .mk-primary { align-self: flex-end; padding: 6px 12px; border: 0; border-radius: 6px; background: #0d99ff; color: #fff; cursor: pointer; }
    .mk-toast { position: fixed; z-index: 2147483001; left: 50%; bottom: 24px; transform: translateX(-50%); padding: 8px 14px; border-radius: 8px; background: #e5e5e5; color: #1e1e1e; box-shadow: 0 6px 20px rgb(0 0 0 / 0.35); }
  `;

  const root = document.querySelector("[data-mock-root]");
  if (!root) {
    console.error("mock shell: add data-mock-root to the element that wraps the component");
    return;
  }

  let notes = { elements: {}, edits: {}, renames: {} };
  let mode = "preview";
  let selected = null;
  let revision = 0;
  let savedRevision = 0;
  let autosaveTimer = null;
  let colorFormat = "hex";

  function h(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
      else if (key === "html") el.innerHTML = value;
      else if (key === "text") el.textContent = value;
      else el.setAttribute(key, value);
    }
    el.append(...children);
    return el;
  }

  const instancesOf = (id) => [...root.querySelectorAll(`[data-ui="${CSS.escape(id)}"]`)];
  const uiElementAt = (target) => {
    const el = target instanceof Element ? target.closest("[data-ui]") : null;
    return el && root.contains(el) ? el : null;
  };

  const elementNote = (id) => notes.elements[id] ?? { behaviour: [], comments: [] };
  const elementEdit = (id) => notes.edits[id] ?? { style: {}, text: {} };
  const updateNote = (id, patch) => {
    notes = { ...notes, elements: { ...notes.elements, [id]: { ...elementNote(id), ...patch } } };
  };
  const updateEdit = (id, patch) => {
    notes = { ...notes, edits: { ...notes.edits, [id]: { ...elementEdit(id), ...patch } } };
  };

  function applyRenames() {
    const targets = Object.entries(notes.renames).map(([from, to]) => [instancesOf(from), to]);
    const componentName = notes.renames[root.dataset.mockRoot];
    for (const [instances, to] of targets) {
      for (const el of instances) el.dataset.ui = to;
    }
    if (componentName) root.dataset.mockRoot = componentName;
  }

  const withoutKey = (object, key) => Object.fromEntries(Object.entries(object).filter(([k]) => k !== key));
  const renameKey = (object, from, to) => (from in object ? { ...withoutKey(object, from), [to]: object[from] } : object);

  function nameProblem(to, original) {
    if (!NAME_PATTERN.test(to)) return `"${to}" is not a valid name in code`;
    const isRenamedAway = to in notes.renames && to !== original;
    const isTaken = instancesOf(to).length > 0 || to in notes.elements || to in notes.edits || isRenamedAway;
    return isTaken ? `"${to}" is already taken` : null;
  }

  function rename(from, to) {
    if (to === from) return true;
    const original = Object.keys(notes.renames).find((key) => notes.renames[key] === from) ?? from;
    const problem = nameProblem(to, original);
    if (problem) {
      toast(problem);
      return false;
    }
    const renames = withoutKey(notes.renames, original);
    notes = {
      elements: renameKey(notes.elements, from, to),
      edits: renameKey(notes.edits, from, to),
      renames: original === to ? renames : { ...renames, [original]: to },
    };
    for (const el of instancesOf(from)) el.dataset.ui = to;
    if (root.dataset.mockRoot === from) root.dataset.mockRoot = to;
    if (currentAssumption?.id === from) currentAssumption = { ...currentAssumption, id: to };
    scheduleAutosave();
    renderAssumptionNav();
    renderTitle();
    if (selected?.id === from) selectId(to);
    return true;
  }

  function applyEdits() {
    for (const [id, edit] of Object.entries(notes.edits)) {
      const instances = instancesOf(id);
      for (const el of instances) {
        for (const [prop, value] of Object.entries(edit.style ?? {})) el.style.setProperty(prop, value);
      }
      for (const [nth, text] of Object.entries(edit.text ?? {})) {
        if (instances[nth]) instances[nth].textContent = text;
      }
    }
  }

  function markOpenComments() {
    for (const el of root.querySelectorAll("[data-mk-open]")) el.removeAttribute("data-mk-open");
    for (const [id, note] of Object.entries(notes.elements)) {
      if (!note.comments?.some((c) => !c.resolved)) continue;
      for (const el of instancesOf(id)) el.setAttribute("data-mk-open", "");
    }
  }

  const toastEl = h("div", { class: "mk-toast mk-chrome", role: "status" });
  let toastTimer = null;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastEl.hidden = true), TOAST_MS);
  }
  toastEl.hidden = true;

  const statusEl = h("span", { class: "mk-save", role: "status", html: ICON_DISK });

  function setStatus(state, text) {
    statusEl.dataset.state = state;
    statusEl.title = text;
    statusEl.setAttribute("aria-label", text);
  }
  setStatus("saved", "No unsaved changes");

  const titleEl = h("h1", {
    contenteditable: "plaintext-only",
    spellcheck: "false",
    "aria-label": "Component name",
    title: "Component name. Edit to rename.",
    onblur: () => {
      rename(root.dataset.mockRoot, titleEl.textContent.trim());
      renderTitle();
    },
    onkeydown: (event) => {
      if (event.key !== "Enter" && event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") renderTitle();
      titleEl.blur();
    },
  });

  function renderTitle() {
    titleEl.textContent = root.dataset.mockRoot;
  }

  function scheduleAutosave() {
    revision += 1;
    setStatus("saving", "Saving…");
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(save, AUTOSAVE_DELAY_MS);
  }

  async function save() {
    clearTimeout(autosaveTimer);
    const savingRevision = revision;
    setStatus("saving", "Saving…");
    try {
      const response = await fetch(NOTES_URL, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(notes, null, 2),
      });
      if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
      savedRevision = savingRevision;
      if (revision === savedRevision) setStatus("saved", "All changes saved");
    } catch (error) {
      setStatus("error", "Save failed");
      toast(`Save failed: ${error.message}`);
    }
  }

  async function load() {
    try {
      const response = await fetch(NOTES_URL);
      if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
      const data = await response.json();
      notes = { elements: data.elements ?? {}, edits: data.edits ?? {}, renames: data.renames ?? {} };
      applyRenames();
      renderTitle();
      applyEdits();
      markOpenComments();
      renderAssumptionNav();
    } catch (error) {
      setStatus("error", "Not connected");
      toast(`Could not load notes (${error.message}). Open the mock through serve.mjs.`);
    }
  }

  const modeButtons = {
    preview: h("button", {
      type: "button",
      "aria-label": "Preview: interact with the component",
      title: "Preview",
      html: ICON_CURSOR,
      onclick: () => setMode("preview"),
    }),
    inspect: h("button", {
      type: "button",
      "aria-label": "Inspect: describe, comment and edit elements",
      title: "Inspect",
      html: ICON_TARGET,
      onclick: () => setMode("inspect"),
    }),
  };

  const hoverBox = h("div", { class: "mk-box mk-chrome", "data-kind": "hover" }, [h("span")]);
  const selectBox = h("div", { class: "mk-box mk-chrome", "data-kind": "selected" }, [h("span")]);
  const panel = h("aside", { class: "mk-panel mk-chrome", "aria-label": "Element inspector" });
  panel.hidden = true;

  function placeBox(box, el) {
    if (!el || !el.isConnected) {
      box.style.display = "none";
      return;
    }
    const rect = el.getBoundingClientRect();
    Object.assign(box.style, {
      display: "block",
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    box.firstChild.textContent = el.dataset.ui;
  }

  function setMode(next) {
    mode = next;
    try {
      sessionStorage.setItem(MODE_KEY, mode);
    } catch {}
    document.documentElement.classList.toggle("mk-inspect", mode === "inspect");
    for (const [name, button] of Object.entries(modeButtons)) button.setAttribute("aria-pressed", String(name === mode));
    if (mode === "preview") select(null);
    placeBox(hoverBox, null);
  }

  function select(el) {
    selected = el ? { id: el.dataset.ui, el } : null;
    placeBox(hoverBox, null);
    renderPanel();
    requestAnimationFrame(() => placeBox(selectBox, selected?.el));
  }

  const visibleInstance = (id) => instancesOf(id).find((instance) => instance.getClientRects().length > 0) ?? null;

  function selectId(id) {
    if (!visibleInstance(id)) window.mockReveal?.(id);
    const el = visibleInstance(id);
    el?.scrollIntoView({ block: "nearest" });
    selected = { id, el };
    placeBox(hoverBox, null);
    renderPanel();
    requestAnimationFrame(() => placeBox(selectBox, el));
  }

  function section(title, children) {
    return h("section", {}, [h("h3", { text: title }), ...children]);
  }

  const rulesOf = (id) => elementNote(id).behaviour ?? [];

  function setRules(id, behaviour, { rerender = true } = {}) {
    updateNote(id, { behaviour });
    scheduleAutosave();
    renderAssumptionNav();
    if (rerender) renderPanel();
  }

  function focusRule(index) {
    const field = panel.querySelector(`[data-rule="${index}"] textarea`);
    field?.focus();
    field?.scrollIntoView({ block: "nearest" });
  }

  function ruleView(id, rule, index) {
    const isAssumption = rule.source === "assumption";
    const isCurrent = currentAssumption?.id === id && currentAssumption.index === index;
    const text = h("textarea", {
      rows: "1",
      "aria-label": `Rule ${index + 1}`,
      placeholder: "On click, …",
      oninput: (event) => {
        const behaviour = rulesOf(id).map((r, i) => (i === index ? { ...r, text: event.target.value } : r));
        setRules(id, behaviour, { rerender: false });
      },
    });
    text.value = rule.text;
    const confirm = h("button", {
      type: "button",
      class: "mk-icon mk-confirm",
      "aria-label": `Confirm rule ${index + 1} as spec`,
      title: "Confirm: turn this assumption into spec",
      text: "✓",
      onclick: () => setRules(id, rulesOf(id).map((r, i) => (i === index ? { ...r, source: "spec" } : r))),
    });
    const remove = h("button", {
      type: "button",
      class: "mk-icon",
      "aria-label": `Delete rule ${index + 1}`,
      title: "Delete rule",
      text: "🗑️",
      onclick: () => setRules(id, rulesOf(id).filter((_, i) => i !== index)),
    });
    return h("li", { class: "mk-rule", "data-rule": String(index), "data-source": rule.source, "data-current": String(isCurrent) }, [
      h("span", {
        class: "mk-badge",
        title: isAssumption ? "Assumption: not settled by the spec" : "From the spec",
        text: String(index + 1),
      }),
      text,
      h("div", { class: "mk-rule-actions" }, [...(isAssumption ? [confirm] : []), remove]),
    ]);
  }

  function behaviourSection(id) {
    const rules = rulesOf(id);
    const add = h("button", {
      type: "button",
      class: "mk-add",
      text: "+ Add rule",
      onclick: () => {
        setRules(id, [...rulesOf(id), { text: "", source: "spec" }]);
        focusRule(rules.length);
      },
    });
    return section("Behaviour", [h("ol", { class: "mk-rules" }, rules.map((rule, index) => ruleView(id, rule, index))), add]);
  }

  let currentAssumption = null;
  const assumptionCount = h("span");
  const assumptionNav = h("div", { class: "mk-bar mk-assumptions mk-chrome", role: "toolbar", "aria-label": "Assumptions" });

  function assumptions() {
    return Object.entries(notes.elements).flatMap(([id, note], order) =>
      (note.behaviour ?? []).flatMap((rule, index) => (rule.source === "assumption" ? [{ id, index, order }] : [])));
  }

  function positionOf({ id, index }) {
    const order = Object.keys(notes.elements).indexOf(id);
    return [order, index];
  }

  const isBefore = ([a1, a2], [b1, b2]) => a1 < b1 || (a1 === b1 && a2 < b2);

  function goToAssumption(direction) {
    const list = assumptions();
    if (list.length === 0) return;
    const here = currentAssumption ? positionOf(currentAssumption) : [-1, -1];
    const target = direction > 0
      ? list.find((item) => isBefore(here, [item.order, item.index])) ?? list[0]
      : list.findLast((item) => isBefore([item.order, item.index], here)) ?? list.at(-1);
    currentAssumption = { id: target.id, index: target.index };
    setMode("inspect");
    selectId(target.id);
    focusRule(target.index);
    renderAssumptionNav();
  }

  function renderAssumptionNav() {
    const list = assumptions();
    const at = list.findIndex((item) => item.id === currentAssumption?.id && item.index === currentAssumption.index);
    assumptionNav.dataset.empty = String(list.length === 0);
    assumptionCount.textContent = list.length === 0
      ? "No assumptions"
      : `${at >= 0 ? `${at + 1}/` : ""}${list.length} assumption${list.length === 1 ? "" : "s"}`;
    for (const button of assumptionNav.querySelectorAll("button")) button.disabled = list.length === 0;
  }

  assumptionNav.append(
    h("button", { type: "button", "aria-label": "Previous assumption", title: "Previous assumption", text: "‹", onclick: () => goToAssumption(-1) }),
    h("button", {
      type: "button",
      class: "mk-count",
      title: "Go to the next assumption. Yellow rules are assumptions; confirm them with ✓.",
      onclick: () => goToAssumption(1),
    }, [h("span", { class: "mk-dot" }), assumptionCount]),
    h("button", { type: "button", "aria-label": "Next assumption", title: "Next assumption", text: "›", onclick: () => goToAssumption(1) }),
  );

  function commentView(id, comment, index) {
    const toggle = () => {
      const comments = elementNote(id).comments.map((c, i) => (i === index ? { ...c, resolved: !c.resolved } : c));
      updateNote(id, { comments });
      scheduleAutosave();
      markOpenComments();
      renderPanel();
    };
    const remove = () => {
      updateNote(id, { comments: elementNote(id).comments.filter((_, i) => i !== index) });
      scheduleAutosave();
      markOpenComments();
      renderPanel();
    };
    return h("div", { class: "mk-comment", "data-resolved": String(Boolean(comment.resolved)) }, [
      h("div", {}, [
        h("strong", { text: comment.author === "agent" ? "Agent" : "You" }),
        h("button", { type: "button", class: "mk-link", text: comment.resolved ? "Reopen" : "Resolve", onclick: toggle }),
        h("button", { type: "button", class: "mk-icon", "aria-label": "Delete comment", title: "Delete comment", text: "🗑️", onclick: remove }),
      ]),
      h("p", { text: comment.text }),
      h("span", { class: "mk-muted", text: new Date(comment.at).toLocaleString() }),
    ]);
  }

  function commentsSection(id) {
    const input = h("textarea", { rows: "3", "aria-label": "New comment", placeholder: "Comment… (⌘↵ to send)" });
    const add = () => {
      const text = input.value.trim();
      if (!text) return;
      const comment = { author: "user", text, at: new Date().toISOString(), resolved: false };
      updateNote(id, { comments: [...elementNote(id).comments, comment] });
      scheduleAutosave();
      markOpenComments();
      renderPanel();
    };
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) add();
    });
    const list = elementNote(id).comments.map((comment, index) => commentView(id, comment, index));
    return section("Comments", [
      ...list,
      input,
      h("button", { type: "button", class: "mk-primary", text: "Comment", onclick: add }),
    ]);
  }

  function textSection(id, el) {
    if (el.children.length > 0) return null;
    const nth = instancesOf(id).indexOf(el);
    const textarea = h("textarea", {
      rows: "2",
      "aria-label": "Text",
      oninput: (event) => {
        el.textContent = event.target.value;
        const edit = elementEdit(id);
        updateEdit(id, { text: { ...edit.text, [nth]: event.target.value } });
        scheduleAutosave();
        placeBox(selectBox, el);
      },
    });
    textarea.value = el.textContent;
    return section("Text", [textarea]);
  }

  function setStyle(id, prop, value) {
    const { [prop]: _previous, ...rest } = elementEdit(id).style;
    const style = value ? { ...rest, [prop]: value } : rest;
    for (const instance of instancesOf(id)) {
      if (value) instance.style.setProperty(prop, value);
      else instance.style.removeProperty(prop);
    }
    updateEdit(id, { style });
    scheduleAutosave();
    placeBox(selectBox, selected?.el);
  }

  const colorCanvas = document.createElement("canvas").getContext("2d");

  function parseColor(value) {
    if (!CSS.supports("color", value)) return null;
    colorCanvas.fillStyle = "#000";
    colorCanvas.fillStyle = value;
    const normalized = colorCanvas.fillStyle;
    if (normalized.startsWith("#")) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(normalized.slice(i, i + 2), 16));
      return { r, g, b, a: 1 };
    }
    const [r, g, b, a = 1] = normalized.match(/[\d.]+/g).map(Number);
    return { r, g, b, a };
  }

  const toHex = (n) => Math.round(n).toString(16).padStart(2, "0");
  const round = (n, digits = 2) => Number(n.toFixed(digits));

  function toHsl({ r, g, b }) {
    const [rn, gn, bn] = [r, g, b].map((n) => n / 255);
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0) return { h: 0, s: 0, l: round(l * 100, 1) };
    const s = d / (1 - Math.abs(2 * l - 1));
    const h = max === rn ? ((gn - bn) / d) % 6 : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
    return { h: Math.round((h * 60 + 360) % 360), s: round(s * 100, 1), l: round(l * 100, 1) };
  }

  function formatColor(color, format) {
    const { r, g, b, a } = color;
    const alpha = round(a);
    if (format === "rgb") return alpha < 1 ? `rgb(${r} ${g} ${b} / ${alpha})` : `rgb(${r} ${g} ${b})`;
    if (format === "hsl") {
      const { h: hue, s, l } = toHsl(color);
      return alpha < 1 ? `hsl(${hue} ${s}% ${l}% / ${alpha})` : `hsl(${hue} ${s}% ${l}%)`;
    }
    return `#${toHex(r)}${toHex(g)}${toHex(b)}${alpha < 1 ? toHex(alpha * 255) : ""}`;
  }

  function stepFor(event, kind) {
    if (event.shiftKey) return STEP[kind] * BIG_STEP_FACTOR;
    if (event.altKey) return STEP[kind] * SMALL_STEP_FACTOR;
    return STEP[kind];
  }

  function nudge(value, delta, kind) {
    const match = /^(-?\d*\.?\d+)([a-z%]*)$/i.exec(value.trim());
    if (!match) return null;
    const next = round(Number(match[1]) + delta, 3);
    if (kind === "number") return String(Math.min(1, Math.max(0, next)));
    return `${next}${match[2] || "px"}`;
  }

  function numberControl(input, label, kind, apply) {
    input.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      const next = nudge(input.value, (event.key === "ArrowUp" ? 1 : -1) * stepFor(event, kind), kind);
      if (next === null) return;
      input.value = next;
      apply(next);
    });
    label.addEventListener("pointerdown", (event) => {
      const startX = event.clientX;
      const startValue = input.value;
      label.setPointerCapture(event.pointerId);
      const move = (moveEvent) => {
        const steps = Math.round((moveEvent.clientX - startX) / SCRUB_PX_PER_STEP);
        const next = nudge(startValue, steps * stepFor(moveEvent, kind), kind);
        if (next === null || next === input.value) return;
        input.value = next;
        apply(next);
      };
      const stop = () => {
        label.removeEventListener("pointermove", move);
        label.removeEventListener("pointerup", stop);
      };
      label.addEventListener("pointermove", move);
      label.addEventListener("pointerup", stop);
    });
  }

  function colorControl(value, apply) {
    let color = parseColor(value) ?? { r: 0, g: 0, b: 0, a: 1 };
    const swatch = h("input", { type: "color", "aria-label": "Pick colour" });
    const text = h("input", { class: "mk-color-text", spellcheck: "false" });
    const alpha = h("input", { class: "mk-alpha", "aria-label": "Opacity %" });
    const copy = h("button", { type: "button", class: "mk-icon", "aria-label": "Copy colour", title: "Copy colour", text: "📋" });
    const show = (editing = null) => {
      swatch.value = formatColor({ ...color, a: 1 }, "hex");
      if (editing !== alpha) alpha.value = `${Math.round(color.a * 100)}%`;
      if (editing !== text) text.value = formatColor(color, colorFormat);
    };
    const commit = (next, editing) => {
      color = next;
      show(editing);
      apply(formatColor(color, colorFormat));
    };
    swatch.addEventListener("input", () => commit({ ...parseColor(swatch.value), a: color.a }));
    text.addEventListener("input", () => {
      const parsed = parseColor(text.value.trim());
      if (parsed) commit(parsed, text);
    });
    text.addEventListener("blur", () => show());
    alpha.addEventListener("blur", () => show());
    alpha.addEventListener("input", () => {
      const percent = parseFloat(alpha.value);
      if (!Number.isNaN(percent)) commit({ ...color, a: Math.min(100, Math.max(0, percent)) / 100 }, alpha);
    });
    alpha.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      const delta = (event.key === "ArrowUp" ? 1 : -1) * (event.shiftKey ? BIG_STEP_FACTOR : 1);
      commit({ ...color, a: Math.min(100, Math.max(0, Math.round(color.a * 100) + delta)) / 100 });
    });
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(text.value);
        toast(`Copied ${text.value}`);
      } catch (error) {
        toast(`Copy failed: ${error.message}`);
      }
    });
    show();
    return h("div", { class: "mk-color" }, [swatch, text, alpha, copy]);
  }

  function styleRow(id, computed, [prop, kind, optionsOrLabel, selectLabel]) {
    const options = kind === "select" ? optionsOrLabel : null;
    const labelText = (kind === "select" ? selectLabel : optionsOrLabel) ?? prop;
    const value = elementEdit(id).style[prop] ?? computed.getPropertyValue(prop).trim();
    const fieldId = `mk-${prop}`;
    const row = h("div", { class: "mk-row", "data-edited": String(prop in elementEdit(id).style) });
    const label = h("label", { for: fieldId, "data-kind": kind, title: prop, text: labelText });
    const apply = (next) => {
      setStyle(id, prop, next);
      row.dataset.edited = "true";
    };
    let control;
    if (kind === "color") {
      control = colorControl(value, apply);
      control.querySelector(".mk-color-text").id = fieldId;
    } else if (kind === "select") {
      control = h("select", { id: fieldId, onchange: (event) => apply(event.target.value) },
        [...new Set([value, ...options])].map((option) => h("option", { value: option, text: option })));
      control.value = value;
    } else {
      control = h("input", { id: fieldId, spellcheck: "false", oninput: (event) => apply(event.target.value.trim()) });
      control.value = value;
      numberControl(control, label, kind, apply);
    }
    const reset = h("button", {
      type: "button",
      class: "mk-icon",
      "aria-label": `Reset ${prop}`,
      title: "Reset",
      text: "↺",
      onclick: () => {
        setStyle(id, prop, "");
        renderPanel();
      },
    });
    row.append(label, control, reset);
    return row;
  }

  function styleSection(id, el) {
    const computed = getComputedStyle(el);
    const formats = h("div", { class: "mk-formats", role: "group", "aria-label": "Colour format" },
      COLOR_FORMATS.map((format) => h("button", {
        type: "button",
        "aria-pressed": String(format === colorFormat),
        text: format,
        onclick: () => {
          colorFormat = format;
          renderPanel();
        },
      })));
    const groups = STYLE_GROUPS.map(({ title, controls }) =>
      h("div", { class: "mk-group" }, [h("h4", { text: title }), ...controls.map((control) => styleRow(id, computed, control))]));
    return section("Style (all instances)", [formats, ...groups]);
  }

  function renderPanel() {
    const isOpen = Boolean(selected);
    panel.hidden = !isOpen;
    document.documentElement.classList.toggle("mk-has-panel", isOpen);
    if (!isOpen) {
      panel.replaceChildren();
      placeBox(selectBox, null);
      return;
    }
    const { id, el } = selected;
    const count = instancesOf(id).length;
    const name = h("input", {
      class: "mk-name",
      "aria-label": "Name in code",
      title: "Name in code. Edit to rename.",
      spellcheck: "false",
      onchange: (event) => {
        if (!rename(id, event.target.value.trim())) event.target.value = id;
      },
      onkeydown: (event) => {
        if (event.key === "Enter") event.target.blur();
      },
    });
    name.value = id;
    panel.replaceChildren(
      h("header", {}, [
        name,
        h("span", { class: "mk-muted", text: count > 1 ? `×${count}` : "" }),
        h("button", { type: "button", "aria-label": "Close inspector", text: "✕", onclick: () => select(null) }),
      ]),
      behaviourSection(id),
      commentsSection(id),
      ...(el
        ? [textSection(id, el), styleSection(id, el)].filter(Boolean)
        : [h("section", {}, [h("p", { class: "mk-muted", text: "Not visible in this state. Open it in preview to edit its text and style." })])]),
    );
  }

  const blockInInspect = (event) => {
    if (mode !== "inspect" || !root.contains(event.target)) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    return true;
  };

  const outOfScopeAt = (target) => {
    const el = target instanceof Element ? target.closest("[data-oos]") : null;
    return el && root.contains(el) ? el : null;
  };

  for (const type of ["pointerdown", "mousedown", "dblclick", "submit", "change", "input"]) {
    document.addEventListener(type, blockInInspect, true);
  }

  document.addEventListener(
    "mousedown",
    (event) => {
      if (mode === "preview" && outOfScopeAt(event.target)) event.preventDefault();
    },
    true,
  );

  document.addEventListener(
    "click",
    (event) => {
      if (blockInInspect(event)) {
        select(uiElementAt(event.target));
        return;
      }
      const oos = mode === "preview" ? outOfScopeAt(event.target) : null;
      if (!oos) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      toast(`Out of scope: ${oos.dataset.oos || oos.dataset.ui || "needs the real app"}`);
    },
    true,
  );

  document.addEventListener("pointerover", (event) => {
    if (mode === "inspect") placeBox(hoverBox, uiElementAt(event.target));
  });

  const reposition = () => {
    placeBox(selectBox, selected?.el);
    placeBox(hoverBox, null);
  };
  window.addEventListener("scroll", reposition, true);
  window.addEventListener("resize", reposition);

  const HELP_ITEMS = [
    "Cursor: interact with the component.",
    "Crosshair: pick an element. In the panel, rename it, edit, add or delete its behaviour rules, comment on it, or edit its text and style.",
    "Yellow rules are assumptions. Confirm one with ✓ to turn it into spec (green).",
    "The counter at the top right jumps between assumptions.",
    "Click the component name at the top left to rename it.",
    "Every change applies live and saves automatically: the disk next to the name pulses while saving and turns red if saving fails. Esc closes the panel.",
  ];
  const helpCard = h("div", { class: "mk-help-card mk-chrome", id: "mk-help", role: "dialog", "aria-label": "How to use this mock" }, [
    h("ul", {}, HELP_ITEMS.map((text) => h("li", { text }))),
  ]);
  const helpButton = h("button", {
    type: "button",
    "aria-label": "How to use this mock",
    title: "How to use this mock",
    "aria-controls": "mk-help",
    text: "?",
    onclick: () => setHelpOpen(helpCard.hidden),
  });

  function setHelpOpen(isOpen) {
    helpCard.hidden = !isOpen;
    helpButton.setAttribute("aria-expanded", String(isOpen));
  }
  setHelpOpen(false);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!helpCard.hidden) setHelpOpen(false);
    else if (selected) select(null);
  });

  window.addEventListener("beforeunload", (event) => {
    if (revision !== savedRevision) event.preventDefault();
  });

  const style = h("style", { text: SHELL_CSS });
  document.head.append(style);
  document.body.append(
    h("div", { class: "mk-bar mk-modes mk-chrome", role: "toolbar", "aria-label": "Mock mode" }, [
      modeButtons.preview,
      modeButtons.inspect,
    ]),
    h("div", { class: "mk-bar mk-title mk-chrome" }, root.dataset.mockRoot ? [titleEl, statusEl] : [statusEl]),
    assumptionNav,
    h("div", { class: "mk-bar mk-help mk-chrome" }, [helpButton]),
    helpCard,
    hoverBox,
    selectBox,
    panel,
    toastEl,
  );

  function savedMode() {
    try {
      return sessionStorage.getItem(MODE_KEY) === "inspect" ? "inspect" : "preview";
    } catch {
      return "preview";
    }
  }

  new EventSource(EVENTS_URL).onmessage = () => {
    if (revision === savedRevision) return location.reload();
    toast("The mock changed on disk. Reload to see it; unsaved edits will be lost.");
  };

  setMode(savedMode());
  renderTitle();
  renderAssumptionNav();
  load();
})();
