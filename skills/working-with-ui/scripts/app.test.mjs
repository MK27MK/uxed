import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { appShellTag, createAppServer } from "./serve.mjs";

const APP = "http://localhost:3000";

let root;
let server;
let base;

before(async () => {
  root = await mkdtemp(join(tmpdir(), "app-"));
  await mkdir(join(root, "src"));
  await writeFile(join(root, "src", "global.css"), ".toolbar { color: red; }\n");
  await writeFile(join(root, "src", "button.module.css"), ".root { color: blue; }\n");
  server = createAppServer({ app: APP, root });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.closeAllConnections();
  server.close();
});

test("builds the script tag that loads the shell into the app from this server", () => {
  assert.equal(appShellTag(`${base}/`), `<script src="${base}/__mock/shell.js" data-mode="app" defer></script>`);
});

test("serves the shell script", async () => {
  const response = await fetch(`${base}/__mock/shell.js`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /javascript/);
});

test("lets the app's origin, under any loopback alias, read the shell routes", async () => {
  for (const origin of [APP, "http://127.0.0.1:3000", "http://[::1]:3000"]) {
    const response = await fetch(`${base}/__mock/notes`, { headers: { origin } });
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
  }
});

test("withholds CORS access from any other origin", async () => {
  for (const origin of ["http://localhost:3001", "https://localhost:3000", "https://example.com"]) {
    const response = await fetch(`${base}/__mock/notes`, { headers: { origin } });
    assert.equal(response.headers.get("access-control-allow-origin"), null);
  }
});

test("answers the preflight of the app saving its notes", async () => {
  const response = await fetch(`${base}/__mock/notes`, {
    method: "OPTIONS",
    headers: { origin: APP, "access-control-request-method": "PUT", "access-control-request-headers": "content-type" },
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), APP);
  assert.match(response.headers.get("access-control-allow-methods"), /PUT/);
  assert.match(response.headers.get("access-control-allow-headers"), /content-type/);
});

test("lists the classes the project defines in plain stylesheets", async () => {
  const response = await fetch(`${base}/__mock/classes`);
  assert.deepEqual(await response.json(), ["toolbar"]);
});

test("keeps the notes in a self-ignoring .uxed folder of the project", async () => {
  const notes = { elements: {}, edits: { "button.root": { style: { color: "red" } } }, renames: {} };
  const put = await fetch(`${base}/__mock/notes`, { method: "PUT", body: JSON.stringify(notes) });
  assert.equal(put.status, 204);
  assert.deepEqual(JSON.parse(await readFile(join(root, ".uxed", "notes.json"), "utf8")), notes);
  assert.equal(await readFile(join(root, ".uxed", ".gitignore"), "utf8"), "*\n");
});

test("serves nothing but the shell routes", async () => {
  const response = await fetch(`${base}/`);
  assert.equal(response.status, 404);
});
