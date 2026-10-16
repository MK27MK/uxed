import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { createMockServer } from "./serve.mjs";

let dir;
let server;
let base;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "mock-"));
  await writeFile(join(dir, "mock.html"), "<main data-mock-root></main>");
  server = createMockServer(dir);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.closeAllConnections();
  server.close();
});

const QUIET_MS = 400;

async function subscribe() {
  const controller = new AbortController();
  const response = await fetch(`${base}/__mock/events`, { signal: controller.signal });
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  await reader.read();
  const next = () => Promise.race([reader.read().then(({ value }) => value), sleep(QUIET_MS * 3).then(() => null)]);
  return { next, close: () => controller.abort() };
}

test("serves mock.html at the root", async () => {
  const response = await fetch(`${base}/`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /data-mock-root/);
});

test("serves the shell script", async () => {
  const response = await fetch(`${base}/__mock/shell.js`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /javascript/);
});

test("returns empty notes before the first save", async () => {
  const response = await fetch(`${base}/__mock/notes`);
  assert.deepEqual(await response.json(), { elements: {}, edits: {}, renames: {} });
});

test("saves valid notes and returns them", async () => {
  const notes = { elements: { run: { behaviour: "1. Start.", comments: [] } }, edits: {} };
  const put = await fetch(`${base}/__mock/notes`, { method: "PUT", body: JSON.stringify(notes) });
  assert.equal(put.status, 204);
  assert.deepEqual(JSON.parse(await readFile(join(dir, "mock.notes.json"), "utf8")), notes);
  assert.deepEqual(await (await fetch(`${base}/__mock/notes`)).json(), notes);
});

test("rejects notes with the wrong shape", async () => {
  const response = await fetch(`${base}/__mock/notes`, { method: "PUT", body: JSON.stringify({ elements: [] }) });
  assert.equal(response.status, 400);
});

test("rejects renames that are not an object", async () => {
  const notes = { elements: {}, edits: {}, renames: ["Old", "New"] };
  const response = await fetch(`${base}/__mock/notes`, { method: "PUT", body: JSON.stringify(notes) });
  assert.equal(response.status, 400);
});

test("rejects malformed JSON", async () => {
  const response = await fetch(`${base}/__mock/notes`, { method: "PUT", body: "{" });
  assert.equal(response.status, 400);
});

test("does not serve files outside the component folder", async () => {
  const response = await fetch(`${base}/%2e%2e/%2e%2e/etc/passwd`);
  assert.equal(response.status, 404);
});

test("tells open pages to reload when mock.html changes", async () => {
  const events = await subscribe();
  await writeFile(join(dir, "mock.html"), "<main data-mock-root>changed</main>");
  assert.match(await events.next(), /reload/);
  events.close();
});

test("tells open pages to reload when someone else rewrites the notes", async () => {
  const events = await subscribe();
  await writeFile(join(dir, "mock.notes.json"), JSON.stringify({ elements: {}, edits: { x: {} } }));
  assert.match(await events.next(), /reload/);
  events.close();
});

test("does not reload pages for notes the shell saved itself", async () => {
  const events = await subscribe();
  const notes = { elements: { own: { behaviour: "1. Mine.", comments: [] } }, edits: {} };
  await fetch(`${base}/__mock/notes`, { method: "PUT", body: JSON.stringify(notes) });
  assert.equal(await events.next(), null);
  events.close();
});
