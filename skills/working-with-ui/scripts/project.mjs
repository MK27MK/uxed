import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";

const SKIP_DIRS = new Set([
  "node_modules", "dist", "build", "out", "coverage", "target", "vendor", "__pycache__", "venv",
]);
const STYLE_EXTENSIONS = new Set([".css", ".scss", ".sass", ".less", ".pcss"]);
const SFC_EXTENSIONS = new Set([".vue", ".svelte", ".astro"]);
const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".html", ...SFC_EXTENSIONS]);
const MODULE_SUFFIX = /\.module\.[a-z]+$/;
const LINE_COMMENT_EXTENSIONS = new Set([".scss", ".sass", ".less"]);

async function walk(dir, files) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path, files);
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

export async function projectFiles(root) {
  return (await walk(root, [])).sort();
}

function stripCss(css, extension) {
  let text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  if (LINE_COMMENT_EXTENSIONS.has(extension)) text = text.replace(/(^|[^:])\/\/.*$/gm, "$1");
  return text.replace(/url\([^)]*\)/g, "url()").replace(/(["'])(?:\\.|(?!\1)[^\\])*\1/g, '""');
}

export function classSelectors(css, extension = ".css") {
  const names = new Set();
  for (const [, prelude] of stripCss(css, extension).matchAll(/([^{};]+)\{/g)) {
    if (prelude.trim().startsWith("@")) continue;
    for (const [, name] of prelude.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) names.add(name);
  }
  return names;
}

function styleText(path, content) {
  if (!SFC_EXTENSIONS.has(extname(path))) return content;
  return [...content.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(([, css]) => css).join("\n");
}

export const moduleStem = (file) => basename(file).replace(MODULE_SUFFIX, "");

/** Every stylesheet in the project with the classes it defines. Paths are relative to root. */
export async function styleIndex(root) {
  const entries = [];
  for (const path of await projectFiles(root)) {
    const extension = extname(path);
    if (!STYLE_EXTENSIONS.has(extension) && !SFC_EXTENSIONS.has(extension)) continue;
    const classes = classSelectors(styleText(path, await readFile(path, "utf8")), extension);
    if (classes.size === 0) continue;
    entries.push({ file: relative(root, path), module: MODULE_SUFFIX.test(path), classes });
  }
  return entries;
}

/** Classes the project defines in plain (non-module) stylesheets: their names are stable in the DOM. */
export async function plainClasses(root) {
  const names = new Set();
  for (const entry of await styleIndex(root)) {
    if (!entry.module) for (const name of entry.classes) names.add(name);
  }
  return [...names].sort();
}

/** Splits an element id: `stem.local` for a CSS-module class, otherwise a plain name. */
export function parseId(id) {
  const dot = id.lastIndexOf(".");
  return dot > 0 ? { stem: id.slice(0, dot), local: id.slice(dot + 1) } : { stem: null, local: id };
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordPattern = (word) => new RegExp(`(?<![\\w-])${escapeRegExp(word)}(?![\\w-])`);

/** Finds where an element id lives in code: the stylesheets that define it and the sources that use it. */
export async function locate(root, id, index) {
  const { stem, local } = parseId(id);
  const entries = index ?? (await styleIndex(root));
  const styles = entries
    .filter((entry) => entry.classes.has(local) && (stem === null || (entry.module && moduleStem(entry.file) === stem)))
    .map((entry) => entry.file);
  const dataUi = new RegExp(`data-ui=\\{?["'\`]${escapeRegExp(id)}["'\`]`);
  const word = wordPattern(local);
  const sources = [];
  for (const path of await projectFiles(root)) {
    if (!SOURCE_EXTENSIONS.has(extname(path))) continue;
    const content = await readFile(path, "utf8");
    const usesModule = styles.some((style) => MODULE_SUFFIX.test(style) && content.includes(basename(style)));
    const usesPlain = styles.length > 0 && stem === null && word.test(content);
    if (dataUi.test(content) || (usesModule && word.test(content)) || usesPlain) sources.push(relative(root, path));
  }
  return { styles, sources };
}

function topLevelRule(css, selector) {
  let depth = 0;
  let start = 0;
  for (let i = 0; i < css.length; i += 1) {
    if (css.startsWith("/*", i)) {
      i = css.indexOf("*/", i + 2);
      if (i < 0) return null;
      i += 1;
      if (depth === 0) start = i + 1;
    } else if (css[i] === '"' || css[i] === "'") {
      const quote = css[i];
      for (i += 1; i < css.length && css[i] !== quote; i += 1) if (css[i] === "\\") i += 1;
    } else if (css[i] === "{") {
      if (depth === 0 && css.slice(start, i).trim() === selector) {
        const open = i;
        for (let d = 1, j = i + 1; j < css.length; j += 1) {
          if (css[j] === "{") d += 1;
          else if (css[j] === "}" && --d === 0) return { open, close: j };
        }
        return null;
      }
      depth += 1;
    } else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) start = i + 1;
    } else if (css[i] === ";" && depth === 0) {
      start = i + 1;
    }
  }
  return null;
}

/** Blanks nested blocks and comments, keeping offsets, so only the rule's own declarations match. */
function maskNested(body) {
  let depth = 0;
  let masked = "";
  for (let i = 0; i < body.length; i += 1) {
    if (body.startsWith("/*", i)) {
      const end = body.indexOf("*/", i + 2);
      const stop = end < 0 ? body.length : end + 2;
      masked += " ".repeat(stop - i);
      i = stop - 1;
      continue;
    }
    if (body[i] === "{") depth += 1;
    masked += depth > 0 ? " " : body[i];
    if (body[i] === "}") depth -= 1;
  }
  return masked;
}

/**
 * Sets declarations on the top-level rule whose selector is exactly `.className`,
 * appending the rule when the stylesheet has none. Returns the new stylesheet text.
 */
export function setDeclarations(css, className, style) {
  const selector = `.${className}`;
  const rule = topLevelRule(css, selector);
  if (!rule) {
    const body = Object.entries(style).map(([prop, value]) => `  ${prop}: ${value};\n`).join("");
    return `${css.replace(/\s*$/, "\n")}\n${selector} {\n${body}}\n`;
  }
  let body = css.slice(rule.open + 1, rule.close);
  const indent = /\n([ \t]+)[\w-]+\s*:/.exec(body)?.[1] ?? "  ";
  for (const [prop, value] of Object.entries(style)) {
    const declaration = new RegExp(`(^|[;{}\\s])${escapeRegExp(prop)}\\s*:[^;{}]*;?`, "g");
    const match = [...maskNested(body).matchAll(declaration)].at(-1);
    if (match) {
      const at = match.index + match[1].length;
      body = `${body.slice(0, at)}${prop}: ${value};${body.slice(match.index + match[0].length)}`;
    } else {
      const trimmed = body.replace(/\s*$/, "");
      const separator = trimmed.trim() === "" || /[;{}]$/.test(trimmed) ? "" : ";";
      body = `${trimmed}${separator}\n${indent}${prop}: ${value};\n`;
    }
  }
  return `${css.slice(0, rule.open + 1)}${body}${css.slice(rule.close)}`;
}

/** Writes a style edit into the one stylesheet that defines the element's class. */
export async function bakeStyle(root, id, style, index) {
  const { local } = parseId(id);
  const { styles } = await locate(root, id, index);
  const targets = styles.filter((file) => STYLE_EXTENSIONS.has(extname(file)));
  if (targets.length !== 1) {
    return { id, ok: false, reason: targets.length === 0 ? "no stylesheet defines it" : `defined in ${targets.join(", ")}` };
  }
  const path = join(root, targets[0]);
  await writeFile(path, setDeclarations(await readFile(path, "utf8"), local, style));
  return { id, ok: true, file: targets[0] };
}
