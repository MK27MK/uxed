import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { before, test } from "node:test";
import { bakeStyle, classSelectors, locate, parseId, plainClasses, setDeclarations } from "./project.mjs";

let root;

before(async () => {
  root = await mkdtemp(join(tmpdir(), "project-"));
  for (const dir of ["src/bottom-bar", "src/panel", "node_modules/lib", ".next"]) await mkdir(join(root, dir), { recursive: true });
  await writeFile(join(root, "src/bottom-bar/bottom-bar.module.css"), ".bottomBar {\n  display: flex;\n}\n\n.item { color: red; }\n");
  await writeFile(join(root, "src/bottom-bar/bottom-bar.tsx"), 'import styles from "./bottom-bar.module.css";\n<div className={styles.bottomBar} />');
  await writeFile(join(root, "src/panel/panel.module.css"), ".item { color: blue; }\n");
  await writeFile(join(root, "src/panel/panel.tsx"), 'import s from "./panel.module.css";\n<li className={s.item} data-ui="PanelRow" />');
  await writeFile(join(root, "src/globals.css"), "/* .commented {} */\n.toolbar, .toolbar:hover { background: url(a.png); }\n@media (min-width: 1.5em) { .wide { gap: 0; } }\n");
  await writeFile(join(root, "src/Card.vue"), '<template><div class="card" /></template>\n<style scoped>.card { padding: 4px; }</style>');
  await writeFile(join(root, "node_modules/lib/lib.css"), ".vendor { color: red; }\n");
  await writeFile(join(root, ".next/build.css"), ".built { color: red; }\n");
});

test("reads class selectors, not comments, urls or numbers", () => {
  const css = "/* .no {} */ .a, .b:hover > .c { width: 1.5em; background: url(x.png) } @media (min-width: 2.5em) { .d {} }";
  assert.deepEqual([...classSelectors(css)].sort(), ["a", "b", "c", "d"]);
});

test("lists plain classes from stylesheets and component style blocks, skipping modules and build output", async () => {
  assert.deepEqual(await plainClasses(root), ["card", "toolbar", "wide"]);
});

test("splits module ids from plain names", () => {
  assert.deepEqual(parseId("bottom-bar.bottomBar"), { stem: "bottom-bar", local: "bottomBar" });
  assert.deepEqual(parseId("toolbar"), { stem: null, local: "toolbar" });
});

test("locates a module class in its own stylesheet and the component that imports it", async () => {
  assert.deepEqual(await locate(root, "panel.item"), {
    styles: ["src/panel/panel.module.css"],
    sources: ["src/panel/panel.tsx"],
  });
});

test("locates a data-ui name in the source that declares it", async () => {
  assert.deepEqual(await locate(root, "PanelRow"), { styles: [], sources: ["src/panel/panel.tsx"] });
});

test("sets declarations on the matching rule only", () => {
  const css = ".a {\n  color: red;\n  &:hover { color: blue; }\n}\n.a .b { color: green; }\n";
  assert.equal(
    setDeclarations(css, "a", { color: "#fff", gap: "4px" }),
    ".a {\n  color: #fff;\n  &:hover { color: blue; }\n  gap: 4px;\n}\n.a .b { color: green; }\n",
  );
});

test("does not mistake a longer property for the edited one", () => {
  assert.equal(setDeclarations(".a { padding-top: 1px }", "a", { padding: "2px" }), ".a { padding-top: 1px;\n  padding: 2px;\n}");
});

test("appends a rule when the stylesheet has none for the class", () => {
  assert.equal(setDeclarations(".x {}\n", "a", { gap: "4px" }), ".x {}\n\n.a {\n  gap: 4px;\n}\n");
});

test("bakes a style edit into the element's module stylesheet", async () => {
  const result = await bakeStyle(root, "bottom-bar.bottomBar", { gap: "8px" });
  assert.deepEqual(result, { id: "bottom-bar.bottomBar", ok: true, file: "src/bottom-bar/bottom-bar.module.css" });
  assert.match(await readFile(join(root, "src/bottom-bar/bottom-bar.module.css"), "utf8"), /display: flex;\n {2}gap: 8px;\n\}/);
});

test("refuses to bake a plain name that several stylesheets define", async () => {
  const result = await bakeStyle(root, "item", { gap: "8px" });
  assert.equal(result.ok, false);
  assert.match(result.reason, /bottom-bar\.module\.css, src\/panel\/panel\.module\.css/);
});
