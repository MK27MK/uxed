#!/usr/bin/env node
import { readFile, rename, writeFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bakeStyle, locate, styleIndex } from "./project.mjs";

const MOCK_NOTES = "mock.notes.json";
const EMPTY = () => ({ elements: {}, edits: {}, renames: {} });
const TEXT_PREVIEW = 80;

const isAppNotes = (path) => basename(path) !== MOCK_NOTES;
const clip = (text) => (text.length > TEXT_PREVIEW ? `${text.slice(0, TEXT_PREVIEW - 1)}…` : text).replace(/\s+/g, " ");

export async function readNotes(path) {
  try {
    return { ...EMPTY(), ...JSON.parse(await readFile(path, "utf8")) };
  } catch (error) {
    if (error.code === "ENOENT") return EMPTY();
    throw error;
  }
}

export async function writeNotes(path, notes) {
  const tmp = `${path}.tmp`;
  await writeFile(tmp, `${JSON.stringify(notes, null, 2)}\n`);
  await rename(tmp, path);
}

/** User comments that are not resolved and have no agent reply after them. */
export function unansweredComments(note) {
  const comments = note.comments ?? [];
  return comments.flatMap((comment, index) => {
    if (comment.author !== "user" || comment.resolved) return [];
    const answered = comments.slice(index + 1).some((later) => later.author === "agent");
    return answered ? [] : [{ index, text: comment.text }];
  });
}

/** Rules that ask for a change: in app notes, every rule the code does not do yet, and every rule marked removed. */
export function changes(note) {
  return (note.behaviour ?? []).flatMap((rule, index) => (rule.current && !rule.removed ? [] : [{ index, ...rule }]));
}

/** Everything the agent still has to act on, as plain data. */
export function pendingWork(notes, { app }) {
  const elements = Object.entries(notes.elements);
  const edits = Object.entries(notes.edits).filter(([, edit]) =>
    Object.keys(edit.style ?? {}).length > 0 || Object.keys(edit.text ?? {}).length > 0);
  return {
    edits: Object.fromEntries(edits),
    renames: notes.renames ?? {},
    comments: Object.fromEntries(elements.map(([id, note]) => [id, unansweredComments(note)]).filter(([, list]) => list.length > 0)),
    changes: app ? Object.fromEntries(elements.map(([id, note]) => [id, changes(note)]).filter(([, list]) => list.length > 0)) : {},
    assumptions: elements.reduce((count, [, note]) =>
      count + (note.behaviour ?? []).filter((rule) => rule.source === "assumption" && !rule.removed).length, 0),
  };
}

function formatPending(work, files) {
  const lines = [];
  const block = (title, entries) => {
    if (entries.length === 0) return;
    lines.push(title, ...entries.map((entry) => `  ${entry}`));
  };
  block("Edits", Object.entries(work.edits).map(([id, edit]) => {
    const style = Object.entries(edit.style ?? {}).map(([prop, value]) => `${prop}: ${value}`).join("; ");
    const text = Object.entries(edit.text ?? {}).map(([nth, value]) => `text[${nth}]: "${clip(value)}"`).join(" ");
    return [id, style, text].filter(Boolean).join("  ");
  }));
  block("Renames", Object.entries(work.renames).map(([from, to]) => `${from} -> ${to}`));
  block("Comments to answer", Object.entries(work.comments).flatMap(([id, list]) =>
    list.map(({ index, text }) => `${id} [${index}] ${clip(text)}`)));
  block("Changes", Object.entries(work.changes).flatMap(([id, list]) => [
    id,
    ...list.map((rule) => `  ${rule.removed ? "remove" : rule.index + 1} [${rule.source}] ${clip(rule.text)}`),
  ]));
  if (work.assumptions > 0) lines.push(`Assumptions to confirm: ${work.assumptions}`);
  if (files) {
    block("Files", Object.entries(files).map(([id, { styles, sources }]) =>
      `${id}  styles: ${styles.join(", ") || "-"}  sources: ${sources.join(", ") || "-"}`));
  }
  return lines.length > 0 ? lines.join("\n") : "Nothing pending.";
}

export async function pending(path, root) {
  const notes = await readNotes(path);
  const app = isAppNotes(path);
  const work = pendingWork(notes, { app });
  if (!app || !root) return formatPending(work, null);
  const ids = new Set([
    ...Object.keys(work.edits), ...Object.keys(work.renames), ...Object.keys(work.comments),
    ...Object.keys(work.changes),
  ]);
  const index = await styleIndex(root);
  const files = {};
  for (const id of ids) files[id] = await locate(root, id, index);
  return formatPending(work, files);
}

const noteOf = (notes, id) => notes.elements[id] ?? { behaviour: [], comments: [] };

export function reply(notes, id, text, at = new Date().toISOString()) {
  const note = noteOf(notes, id);
  const comment = { author: "agent", text, at, resolved: false };
  return { ...notes, elements: { ...notes.elements, [id]: { ...note, comments: [...(note.comments ?? []), comment] } } };
}

/** Appends a rule. In app notes a new rule is a change the code does not make yet. */
export function addRule(notes, id, text, source) {
  const note = noteOf(notes, id);
  return { ...notes, elements: { ...notes.elements, [id]: { ...note, behaviour: [...(note.behaviour ?? []), { text, source }] } } };
}

/** Marks the element's changes as done: changed rules become current, removed rules go. */
export function implemented(notes, id) {
  const note = noteOf(notes, id);
  const behaviour = (note.behaviour ?? []).filter((rule) => !rule.removed).map((rule) => ({ ...rule, current: true }));
  return { ...notes, elements: { ...notes.elements, [id]: { ...note, behaviour } } };
}

export function clear(notes, field, ids) {
  if (field !== "edits" && field !== "renames") throw new Error(`Cannot clear "${field}": use edits or renames`);
  const keep = ids.length === 0 ? {} : Object.fromEntries(Object.entries(notes[field]).filter(([id]) => !ids.includes(id)));
  return { ...notes, [field]: keep };
}

/** Writes style edits into the stylesheets that define the elements. Text edits stay for the agent. */
export async function bake(path, root, ids) {
  const notes = await readNotes(path);
  const index = await styleIndex(root);
  const results = [];
  const edits = { ...notes.edits };
  for (const [id, edit] of Object.entries(notes.edits)) {
    if (ids.length > 0 && !ids.includes(id)) continue;
    if (Object.keys(edit.style ?? {}).length === 0) continue;
    const result = await bakeStyle(root, id, edit.style, index);
    results.push(result);
    if (!result.ok) continue;
    const { style: _baked, ...rest } = edit;
    if (Object.keys(rest.text ?? {}).length > 0) edits[id] = rest;
    else delete edits[id];
  }
  await writeNotes(path, { ...notes, edits });
  return results.map((r) => (r.ok ? `baked ${r.id} into ${r.file}` : `left ${r.id}: ${r.reason}`)).join("\n") || "No style edits.";
}

function parseArgs(argv) {
  const positional = [];
  let root = process.cwd();
  let assumption = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--root") root = resolve(argv[(i += 1)]);
    else if (argv[i] === "--assumption") assumption = true;
    else positional.push(argv[i]);
  }
  return { positional, root, assumption };
}

const USAGE = `Usage: notes.mjs <command> …  (paths after --root are the project root, default: cwd)
  pending <notes> [--root dir]          what is left to do, with the files of each element in app notes
  reply <notes> <id> <text>             append an agent comment
  rule <notes> <id> <text> [--assumption]  append a behaviour rule (spec unless --assumption)
  implemented <notes> <id>…             mark the elements' changes as done
  clear <notes> edits|renames [id…]     reset edits or renames, all or for the given ids
  bake <notes> [--root dir] [id…]       write style edits into the elements' stylesheets
  locate [--root dir] <id>…             stylesheets and sources of each element`;

async function main() {
  const { positional: [command, ...args], root, assumption } = parseArgs(process.argv.slice(2));
  const update = async (fn) => {
    const path = resolve(args[0]);
    await writeNotes(path, fn(await readNotes(path)));
  };
  switch (command) {
    case "pending":
      return console.log(await pending(resolve(args[0]), root));
    case "reply":
      return update((notes) => reply(notes, args[1], args[2]));
    case "rule":
      return update((notes) => addRule(notes, args[1], args[2], assumption ? "assumption" : "spec"));
    case "implemented":
      return update((notes) => args.slice(1).reduce(implemented, notes));
    case "clear":
      return update((notes) => clear(notes, args[1], args.slice(2)));
    case "bake":
      return console.log(await bake(resolve(args[0]), root, args.slice(1)));
    case "locate": {
      const index = await styleIndex(root);
      for (const id of args) {
        const { styles, sources } = await locate(root, id, index);
        console.log(`${id}\n  styles: ${styles.join(", ") || "-"}\n  sources: ${sources.join(", ") || "-"}`);
      }
      return;
    }
    default:
      console.error(USAGE);
      process.exit(1);
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
