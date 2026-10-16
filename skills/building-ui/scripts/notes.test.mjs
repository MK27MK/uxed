import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { addRule, clear, implemented, pendingWork, reply, unansweredComments } from "./notes.mjs";

const CLI = fileURLToPath(new URL("./notes.mjs", import.meta.url));
const run = (...args) => promisify(execFile)("node", [CLI, ...args]);

const user = (text, extra = {}) => ({ author: "user", text, at: "2026-10-15T10:00:00Z", resolved: false, ...extra });
const agent = (text) => ({ author: "agent", text, at: "2026-10-15T10:05:00Z", resolved: false });

test("only user comments with no agent reply after them need an answer", () => {
  const note = { comments: [user("a"), agent("done"), user("b"), user("c", { resolved: true })] };
  assert.deepEqual(unansweredComments(note), [{ index: 2, text: "b" }]);
});

test("in app notes, every rule the code does not do yet is a change", () => {
  const notes = {
    elements: {
      bar: {
        behaviour: [
          { text: "Shows the price.", source: "spec", current: true },
          { text: "Flashes on change.", source: "spec" },
          { text: "Hides when empty.", source: "assumption", current: true, removed: true },
        ],
        comments: [],
      },
      menu: { behaviour: [], comments: [] },
    },
    edits: { bar: { style: {}, text: {} }, menu: { style: { gap: "4px" } } },
    renames: {},
  };
  const work = pendingWork(notes, { app: true });
  assert.deepEqual(work.changes.bar.map((rule) => rule.index), [1, 2]);
  assert.deepEqual(Object.keys(work.edits), ["menu"]);
  assert.equal(work.assumptions, 0);
  assert.deepEqual(pendingWork(notes, { app: false }).changes, {});
});

test("implementing makes changes current and drops removed rules", () => {
  const notes = { elements: { bar: { behaviour: [{ text: "A", source: "spec" }, { text: "B", source: "spec", current: true, removed: true }] } } };
  assert.deepEqual(implemented(notes, "bar").elements.bar.behaviour, [{ text: "A", source: "spec", current: true }]);
});

test("rule appends a rule with its source", () => {
  const notes = addRule({ elements: { bar: { behaviour: [{ text: "A", source: "spec", current: true }], comments: [] } } }, "bar", "B", "assumption");
  assert.deepEqual(notes.elements.bar.behaviour.at(-1), { text: "B", source: "assumption" });
});

test("reply appends an agent comment", () => {
  const notes = reply({ elements: {}, edits: {}, renames: {} }, "bar", "Done.", "now");
  assert.deepEqual(notes.elements.bar.comments, [{ author: "agent", text: "Done.", at: "now", resolved: false }]);
});

test("clear resets all entries or only the given ids", () => {
  const notes = { elements: {}, edits: { a: {}, b: {} }, renames: { x: "y" } };
  assert.deepEqual(clear(notes, "edits", ["a"]).edits, { b: {} });
  assert.deepEqual(clear(notes, "renames", []).renames, {});
  assert.throws(() => clear(notes, "elements", []));
});

test("the CLI prints pending work with each element's files, and bakes style edits", async () => {
  const root = await mkdtemp(join(tmpdir(), "notes-"));
  await mkdir(join(root, "src"));
  await mkdir(join(root, ".uxed"));
  await writeFile(join(root, "src/bar.module.css"), ".root {\n  gap: 2px;\n}\n");
  await writeFile(join(root, "src/bar.tsx"), 'import s from "./bar.module.css";\n<div className={s.root} />');
  const notesPath = join(root, ".uxed/notes.json");
  await writeFile(notesPath, JSON.stringify({
    elements: { "bar.root": { behaviour: [], comments: [user("Tighter, please.")] } },
    edits: { "bar.root": { style: { gap: "4px" }, text: { 0: "Hi" } } },
    renames: {},
  }));

  const { stdout: before } = await run("pending", notesPath, "--root", root);
  assert.equal(before, [
    "Edits",
    '  bar.root  gap: 4px  text[0]: "Hi"',
    "Comments to answer",
    "  bar.root [0] Tighter, please.",
    "Files",
    "  bar.root  styles: src/bar.module.css  sources: src/bar.tsx",
    "",
  ].join("\n"));

  const { stdout: baked } = await run("bake", notesPath, "--root", root);
  assert.equal(baked, "baked bar.root into src/bar.module.css\n");
  assert.equal(await readFile(join(root, "src/bar.module.css"), "utf8"), ".root {\n  gap: 4px;\n}\n");
  assert.deepEqual(JSON.parse(await readFile(notesPath, "utf8")).edits, { "bar.root": { text: { 0: "Hi" } } });

  await run("reply", notesPath, "bar.root", "Gap is now 4px.");
  await run("rule", notesPath, "bar.root", "Gap is 4px.", "--assumption");
  assert.deepEqual(JSON.parse(await readFile(notesPath, "utf8")).elements["bar.root"].behaviour, [{ text: "Gap is 4px.", source: "assumption" }]);
  await run("clear", notesPath, "edits");
  const { stdout: after } = await run("pending", notesPath, "--root", root);
  assert.equal(after, [
    "Changes",
    "  bar.root",
    "    1 [assumption] Gap is 4px.",
    "Assumptions to confirm: 1",
    "Files",
    "  bar.root  styles: src/bar.module.css  sources: src/bar.tsx",
    "",
  ].join("\n"));
});
