import assert from "node:assert/strict";
import { createServer } from "node:http";
import { connect } from "node:net";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { createAppServer } from "./serve.mjs";

let root;
let upstream;
let upstreamBase;
let proxy;
let base;
let lastRequest;

const listen = async (server) => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return `http://127.0.0.1:${server.address().port}`;
};

before(async () => {
  root = await mkdtemp(join(tmpdir(), "app-"));
  await mkdir(join(root, "src"));
  await writeFile(join(root, "src", "global.css"), ".toolbar { color: red; }\n");
  await writeFile(join(root, "src", "button.module.css"), ".root { color: blue; }\n");
  upstream = createServer((req, res) => {
    lastRequest = { url: req.url, headers: req.headers };
    if (req.url === "/page") {
      const [first, rest] = ["<!doctype html><html><he", 'ad lang="en"><title>App</title></head><body>hi</body></html>'];
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "content-security-policy": "script-src 'none'",
        "content-length": String(Buffer.byteLength(first + rest)),
      });
      res.write(first);
      setTimeout(() => res.end(rest), 20);
    } else if (req.url === "/api") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"ok":true}');
    } else if (req.url === "/old") {
      res.writeHead(307, { location: `${upstreamBase}/page` });
      res.end();
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  upstream.on("upgrade", (req, socket) => {
    lastRequest = { url: req.url, headers: req.headers };
    socket.write("HTTP/1.1 101 Switching Protocols\r\nupgrade: websocket\r\nconnection: Upgrade\r\n\r\n");
    socket.on("data", (data) => socket.write(data));
    socket.on("end", () => socket.destroy());
  });
  upstreamBase = await listen(upstream);
  proxy = createAppServer({ upstream: upstreamBase, root });
  base = await listen(proxy);
});

after(() => {
  for (const server of [proxy, upstream]) {
    server.closeAllConnections();
    server.close();
  }
});

test("injects the shell right after the opening head tag, even when it spans chunks", async () => {
  const response = await fetch(`${base}/page`);
  const html = await response.text();
  assert.match(html, /<head lang="en"><script src="\/__mock\/shell.js" data-mode="app" defer><\/script><title>/);
  assert.equal(response.headers.get("content-security-policy"), null);
  assert.equal(response.headers.get("content-length"), null);
});

test("forwards requests with the upstream's host and origin and no compression", async () => {
  await fetch(`${base}/api`, { headers: { origin: base, referer: `${base}/page`, "accept-encoding": "gzip" } });
  assert.equal(lastRequest.headers.host, new URL(upstreamBase).host);
  assert.equal(lastRequest.headers.origin, upstreamBase);
  assert.equal(lastRequest.headers.referer, `${upstreamBase}/page`);
  assert.equal(lastRequest.headers["accept-encoding"], undefined);
});

test("passes non-HTML responses through untouched", async () => {
  const response = await fetch(`${base}/api`);
  assert.deepEqual(await response.json(), { ok: true });
});

test("rewrites redirects to the upstream back to the proxy", async () => {
  const response = await fetch(`${base}/old`, { redirect: "manual" });
  assert.equal(response.headers.get("location"), `${base}/page`);
});

test("tunnels websocket upgrades to the upstream", async () => {
  const { port } = new URL(base);
  const socket = connect(Number(port), "127.0.0.1");
  await once(socket, "connect");
  socket.write("GET /_next/hmr HTTP/1.1\r\nhost: proxy\r\nupgrade: websocket\r\nconnection: Upgrade\r\n\r\n");
  const [handshake] = await once(socket, "data");
  assert.match(handshake.toString(), /101 Switching Protocols/);
  socket.write("ping");
  const [echo] = await once(socket, "data");
  assert.equal(echo.toString(), "ping");
  assert.equal(lastRequest.url, "/_next/hmr");
  socket.destroy();
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

test("answers 502 when the app is not running", async () => {
  const dead = createAppServer({ upstream: "http://127.0.0.1:1", root });
  const deadBase = await listen(dead);
  const response = await fetch(`${deadBase}/`);
  assert.equal(response.status, 502);
  dead.closeAllConnections();
  dead.close();
});
