#!/usr/bin/env node
import { mkdirSync, readFileSync, realpathSync, watch, writeFileSync } from "node:fs";
import { Agent as HttpAgent, createServer, request as httpRequest } from "node:http";
import { Agent as HttpsAgent, request as httpsRequest } from "node:https";
import { connect as netConnect } from "node:net";
import { connect as tlsConnect } from "node:tls";
import { readFile, rename, stat, writeFile } from "node:fs/promises";
import { StringDecoder } from "node:string_decoder";
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
const APP_SHELL_TAG = '<script src="/__mock/shell.js" data-mode="app" defer></script>';
const HEAD_TAG = /<head(?:\s[^>]*)?>/i;
const MAX_HEAD_SEARCH_CHARS = 256_000;
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

function serve(route, onClose) {
  const server = createServer(async (req, res) => {
    try {
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

/** Request headers as the upstream expects them: its own host and origin, no compression. */
function upstreamHeaders(headers, upstream, proxyOrigin) {
  const next = { ...headers, host: upstream.host };
  delete next["accept-encoding"];
  if (next.origin) next.origin = upstream.origin;
  if (next.referer?.startsWith(proxyOrigin)) next.referer = upstream.origin + next.referer.slice(proxyOrigin.length);
  return next;
}

/** Streams an HTML response through, adding the shell script right after the opening <head> tag. */
function injectShell(source, res) {
  const decoder = new StringDecoder("utf8");
  let buffered = "";
  let passing = false;
  source.on("data", (chunk) => {
    if (passing) return res.write(chunk);
    buffered += decoder.write(chunk);
    const match = HEAD_TAG.exec(buffered);
    if (!match && buffered.length < MAX_HEAD_SEARCH_CHARS) return;
    const at = match ? match.index + match[0].length : buffered.length;
    res.write(`${buffered.slice(0, at)}${match ? APP_SHELL_TAG : ""}${buffered.slice(at)}`);
    buffered = "";
    passing = true;
  });
  source.on("end", () => res.end(passing ? undefined : buffered + decoder.end()));
  source.on("error", () => res.destroy());
}

export function createAppServer({ upstream: upstreamUrl, root: rootDir }) {
  const upstream = new URL(upstreamUrl);
  const root = resolve(rootDir);
  const notesDir = join(root, APP_NOTES_DIR);
  mkdirSync(notesDir, { recursive: true });
  writeFileSync(join(notesDir, ".gitignore"), "*\n");
  const shell = createShellRoutes(notesDir, APP_NOTES_FILE, [APP_NOTES_FILE]);
  const isHttps = upstream.protocol === "https:";
  const request = isHttps ? httpsRequest : httpRequest;
  const upstreamPort = Number(upstream.port) || (isHttps ? 443 : 80);
  const agent = new (isHttps ? HttpsAgent : HttpAgent)({ keepAlive: true });
  const originOf = (req) => `http://${req.headers.host}`;

  function proxy(req, res) {
    const proxyOrigin = originOf(req);
    const outgoing = request(new URL(req.url, upstream), {
      method: req.method,
      headers: upstreamHeaders(req.headers, upstream, proxyOrigin),
      agent,
      rejectUnauthorized: false,
    }, (incoming) => {
      const headers = { ...incoming.headers };
      if (headers.location?.startsWith(upstream.origin)) headers.location = proxyOrigin + headers.location.slice(upstream.origin.length);
      const isHtml = /^text\/html/i.test(headers["content-type"] ?? "") && !headers["content-encoding"] && req.method !== "HEAD";
      if (!isHtml) {
        res.writeHead(incoming.statusCode, headers);
        incoming.pipe(res);
        return;
      }
      delete headers["content-length"];
      delete headers["content-security-policy"];
      delete headers["content-security-policy-report-only"];
      res.writeHead(incoming.statusCode, headers);
      injectShell(incoming, res);
    });
    outgoing.on("error", (error) => {
      if (res.headersSent) res.destroy();
      else send(res, 502, `Cannot reach ${upstream.origin}: ${error.message}`);
    });
    req.pipe(outgoing);
  }

  async function route(req, res) {
    const { pathname } = new URL(req.url, `http://${HOST}`);
    if (pathname === "/__mock/classes") return send(res, 200, JSON.stringify(await plainClasses(root)), CONTENT_TYPES[".json"]);
    if (await shell.handle(req, res, pathname)) return;
    return proxy(req, res);
  }

  const server = serve(route, () => {
    shell.close();
    agent.destroy();
  });

  server.on("upgrade", (req, socket, head) => {
    const connect = isHttps ? tlsConnect : netConnect;
    const options = { host: upstream.hostname, port: upstreamPort, servername: upstream.hostname, rejectUnauthorized: false };
    const outgoing = connect(options, () => {
      const headers = upstreamHeaders(req.headers, upstream, originOf(req));
      const lines = Object.entries(headers).map(([name, value]) => `${name}: ${value}`);
      outgoing.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${lines.join("\r\n")}\r\n\r\n`);
      if (head.length > 0) outgoing.write(head);
      outgoing.pipe(socket);
      socket.pipe(outgoing);
    });
    for (const [from, to] of [[outgoing, socket], [socket, outgoing]]) {
      for (const event of ["error", "end", "close"]) from.on(event, () => to.destroy());
    }
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

const USAGE = `Usage:
  serve.mjs <component-folder> [--port n]            serve the folder's mock.html
  serve.mjs --app <dev-server-url> [--root dir] [--port n]
                                                     proxy the running app with the shell; notes go to <root>/.uxed/notes.json`;

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
    server = createAppServer({ upstream: options.app, root: options.root });
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
      console.log(`http://${HOST}:${bound}/`);
      return;
    } catch (error) {
      if (error.code !== "EADDRINUSE") throw error;
    }
  }
  console.error(`Port${ports.length > 1 ? "s" : ""} ${ports[0]}${ports.length > 1 ? `-${ports.at(-1)}` : ""} in use`);
  process.exit(1);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main();
