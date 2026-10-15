#!/usr/bin/env node
import { mkdirSync, readFileSync, realpathSync, watch, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { readFile, rename, stat, writeFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { plainClasses } from "./project.mjs";

const SHELL_PATH = fileURLToPath(new URL("../assets/shell.js", import.meta.url));
const HOST = "127.0.0.1";
const DEFAULT_PORT = 4870;
const PORT_ATTEMPTS = 20;
const MAX_BODY_BYTES = 1_000_000;
const MOCK_FILE = "mock.html";
const NOTES_FILE = "mock.notes.json";
const APP_NOTES_DIR = ".uxed";
const APP_NOTES_FILE = "notes.json";
const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
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

/**
 * Serves the shell, the notes and the reload events. Pages reload when a watched file
 * changes on disk, except when the change is notes the shell saved itself.
 */
function createShellRoutes(dir, notesFile, watchedFiles) {
  const notesPath = join(dir, notesFile);
  const watchedPaths = Object.fromEntries(watchedFiles.map((name) => [name, join(dir, name)]));
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

  const watcher = watch(dir, (_event, filename) => {
    if (!Object.hasOwn(watchedPaths, filename ?? "")) return;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(reloadIfChanged, RELOAD_DEBOUNCE_MS);
  });
  watcher.unref();

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
    snapshot = { ...snapshot, [notesFile]: text };
    await writeFile(tmpPath, text);
    await rename(tmpPath, notesPath);
    send(res, 204, "");
  }

  /** Handles a /__mock/ route and returns true, or returns false for any other path. */
  async function handle(req, res, pathname) {
    if (pathname === "/__mock/shell.js") await sendFile(res, SHELL_PATH);
    else if (pathname === "/__mock/events") subscribe(req, res);
    else if (pathname === "/__mock/notes") {
      if (req.method === "PUT") await putNotes(req, res);
      else if (req.method === "GET") await getNotes(res);
      else send(res, 405, "Method not allowed");
    } else return false;
    return true;
  }

  function close() {
    clearTimeout(reloadTimer);
    watcher.close();
  }

  return { handle, close };
}

const isLoopbackHost = (host, port) => LOOPBACK_HOSTS.some((name) => host === `${name}:${port}`);

function serve(route, onClose) {
  const server = createServer(async (req, res) => {
    try {
      if (!isLoopbackHost(req.headers.host, server.address().port)) return send(res, 403, "Forbidden host");
      await route(req, res);
    } catch (error) {
      if (!error.status) console.error(error);
      if (res.headersSent) res.destroy();
      else send(res, error.status ?? 500, error.message);
    }
  });
  server.on("close", onClose);
  return server;
}

export function createMockServer(dir) {
  const root = resolve(dir);
  const shell = createShellRoutes(root, NOTES_FILE, [MOCK_FILE, NOTES_FILE]);

  async function route(req, res) {
    const { pathname } = new URL(req.url, `http://${HOST}`);
    if (await shell.handle(req, res, pathname)) return;
    if (req.method !== "GET") return send(res, 405, "Method not allowed");
    const file = resolve(root, `.${decodeURIComponent(pathname === "/" ? `/${MOCK_FILE}` : pathname)}`);
    if (!file.startsWith(root + sep)) return send(res, 404, "Not found");
    return sendFile(res, file);
  }

  return serve(route, shell.close);
}

function appOrigins(appUrl) {
  const app = new URL(appUrl);
  const hosts = LOOPBACK_HOSTS.includes(app.hostname) ? LOOPBACK_HOSTS : [app.hostname];
  return new Set(hosts.map((host) => `${app.protocol}//${host}${app.port ? `:${app.port}` : ""}`));
}

export const appShellTag = (serverUrl) => `<script src="${new URL("/__mock/shell.js", serverUrl)}" data-mode="app" defer></script>`;

export function createAppServer({ app, root: rootDir }) {
  const allowedOrigins = appOrigins(app);
  const root = resolve(rootDir);
  const notesDir = join(root, APP_NOTES_DIR);
  mkdirSync(notesDir, { recursive: true });
  writeFileSync(join(notesDir, ".gitignore"), "*\n");
  const shell = createShellRoutes(notesDir, APP_NOTES_FILE, [APP_NOTES_FILE]);

  async function route(req, res) {
    const { origin } = req.headers;
    if (allowedOrigins.has(origin)) {
      res.setHeader("access-control-allow-origin", origin);
      res.setHeader("access-control-allow-methods", "GET, PUT");
      res.setHeader("access-control-allow-headers", "content-type");
    }
    res.setHeader("vary", "origin");
    if (req.method === "OPTIONS") return send(res, 204, "");
    const { pathname } = new URL(req.url, `http://${HOST}`);
    if (pathname === "/__mock/classes") return send(res, 200, JSON.stringify(await plainClasses(root)), CONTENT_TYPES[".json"]);
    if (await shell.handle(req, res, pathname)) return;
    return send(res, 404, "Not found");
  }

  return serve(route, shell.close);
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

const USAGE = `Usage:
  serve.mjs <component-folder> [--port n]            serve the folder's mock.html
  serve.mjs --app <app-url> [--root dir] [--port n]
                                                     serve the shell to the running app; notes go to <root>/.uxed/notes.json`;

function parseArgs(argv) {
  const options = { root: process.cwd() };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--app") options.app = argv[(i += 1)];
    else if (flag === "--root") options.root = argv[(i += 1)];
    else if (flag === "--port") options.port = Number(argv[(i += 1)]);
    else if (flag.startsWith("--")) throw new Error(`Unknown option ${flag}`);
    else options.dir = flag;
  }
  return options;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`${error.message}\n${USAGE}`);
    process.exit(1);
  }
  let server;
  if (options.app) {
    server = createAppServer({ app: options.app, root: options.root });
  } else {
    const dir = options.dir ?? ".";
    try {
      await stat(join(dir, MOCK_FILE));
    } catch {
      console.error(`No ${MOCK_FILE} in ${resolve(dir)}\n${USAGE}`);
      process.exit(1);
    }
    server = createMockServer(dir);
  }
  const ports = options.port ? [options.port] : Array.from({ length: PORT_ATTEMPTS }, (_, i) => DEFAULT_PORT + i);
  for (const port of ports) {
    try {
      const bound = await listen(server, port);
      const url = `http://${HOST}:${bound}/`;
      console.log(url);
      if (options.app) console.log(appShellTag(url));
      return;
    } catch (error) {
      if (error.code !== "EADDRINUSE") throw error;
    }
  }
  console.error(`Port${ports.length > 1 ? "s" : ""} ${ports[0]}${ports.length > 1 ? `-${ports.at(-1)}` : ""} in use`);
  process.exit(1);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main();
