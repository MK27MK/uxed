#!/usr/bin/env node
import { readFileSync, realpathSync, watch } from "node:fs";
import { createServer } from "node:http";
import { readFile, rename, stat, writeFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SHELL_PATH = fileURLToPath(new URL("../assets/shell.js", import.meta.url));
const HOST = "127.0.0.1";
const DEFAULT_PORT = 4870;
const PORT_ATTEMPTS = 20;
const MAX_BODY_BYTES = 1_000_000;
const MOCK_FILE = "mock.html";
const NOTES_FILE = "mock.notes.json";
const RELOAD_DEBOUNCE_MS = 150;
const EMPTY_NOTES = `${JSON.stringify({ elements: {}, edits: {}, renames: {} }, null, 2)}\n`;
const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const isPlainObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(body);
}

async function sendFile(res, path) {
  try {
    send(res, 200, await readFile(path), CONTENT_TYPES[extname(path)] ?? "application/octet-stream");
  } catch (error) {
    if (error.code !== "ENOENT" && error.code !== "EISDIR") throw error;
    send(res, 404, "Not found");
  }
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error("Body too large"), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseNotes(body) {
  let notes;
  try {
    notes = JSON.parse(body);
  } catch {
    throw Object.assign(new Error("Body is not valid JSON"), { status: 400 });
  }
  const hasValidRenames = notes?.renames === undefined || isPlainObject(notes.renames);
  if (!isPlainObject(notes) || !isPlainObject(notes.elements) || !isPlainObject(notes.edits) || !hasValidRenames) {
    throw Object.assign(new Error("Expected { elements: {}, edits: {}, renames: {} }"), { status: 400 });
  }
  return notes;
}

export function createMockServer(dir) {
  const root = resolve(dir);
  const notesPath = join(root, NOTES_FILE);
  const watchedPaths = { [MOCK_FILE]: join(root, MOCK_FILE), [NOTES_FILE]: notesPath };
  const readSnapshot = () =>
    Object.fromEntries(Object.entries(watchedPaths).map(([name, path]) => {
      try {
        return [name, readFileSync(path, "utf8")];
      } catch {
        return [name, null];
      }
    }));
  let snapshot = readSnapshot();
  const pages = new Set();
  let reloadTimer;

  function reloadIfChanged() {
    const current = readSnapshot();
    const changed = Object.keys(current).some((name) => current[name] !== snapshot[name]);
    snapshot = current;
    if (!changed) return;
    for (const page of pages) page.write("data: reload\n\n");
  }

  const watcher = watch(root, (_event, filename) => {
    if (!Object.hasOwn(watchedPaths, filename ?? "")) return;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(reloadIfChanged, RELOAD_DEBOUNCE_MS);
  });

  function subscribe(req, res) {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store" });
    res.write(": connected\n\n");
    pages.add(res);
    req.on("close", () => pages.delete(res));
  }

  async function getNotes(res) {
    try {
      send(res, 200, await readFile(notesPath, "utf8"), CONTENT_TYPES[".json"]);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      send(res, 200, EMPTY_NOTES, CONTENT_TYPES[".json"]);
    }
  }

  async function putNotes(req, res) {
    const notes = parseNotes(await readBody(req));
    const text = `${JSON.stringify(notes, null, 2)}\n`;
    const tmpPath = `${notesPath}.tmp`;
    snapshot = { ...snapshot, [NOTES_FILE]: text };
    await writeFile(tmpPath, text);
    await rename(tmpPath, notesPath);
    send(res, 204, "");
  }

  async function route(req, res) {
    const { pathname } = new URL(req.url, `http://${HOST}`);
    if (pathname === "/__mock/shell.js") return sendFile(res, SHELL_PATH);
    if (pathname === "/__mock/events") return subscribe(req, res);
    if (pathname === "/__mock/notes") {
      if (req.method === "PUT") return putNotes(req, res);
      if (req.method === "GET") return getNotes(res);
      return send(res, 405, "Method not allowed");
    }
    if (req.method !== "GET") return send(res, 405, "Method not allowed");
    const file = resolve(root, `.${decodeURIComponent(pathname === "/" ? `/${MOCK_FILE}` : pathname)}`);
    if (!file.startsWith(root + sep)) return send(res, 404, "Not found");
    return sendFile(res, file);
  }

  const server = createServer(async (req, res) => {
    try {
      await route(req, res);
    } catch (error) {
      if (!error.status) console.error(error);
      send(res, error.status ?? 500, error.message);
    }
  });
  server.on("close", () => {
    clearTimeout(reloadTimer);
    watcher.close();
  });
  return server;
}

function listen(server, port) {
  return new Promise((resolvePort, reject) => {
    server.once("error", reject);
    server.listen(port, HOST, () => {
      server.off("error", reject);
      resolvePort(server.address().port);
    });
  });
}

async function main() {
  const dir = process.argv[2] ?? ".";
  try {
    await stat(join(dir, MOCK_FILE));
  } catch {
    console.error(`No ${MOCK_FILE} in ${resolve(dir)}`);
    process.exit(1);
  }
  const server = createMockServer(dir);
  for (let port = DEFAULT_PORT; port < DEFAULT_PORT + PORT_ATTEMPTS; port += 1) {
    try {
      const bound = await listen(server, port);
      console.log(`http://${HOST}:${bound}/`);
      return;
    } catch (error) {
      if (error.code !== "EADDRINUSE") throw error;
    }
  }
  console.error(`Ports ${DEFAULT_PORT}-${DEFAULT_PORT + PORT_ATTEMPTS - 1} are all in use`);
  process.exit(1);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main();
