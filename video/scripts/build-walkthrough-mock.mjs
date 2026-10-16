import { readFileSync, writeFileSync } from "node:fs";

const [mockPath, notesPath, outPath] = process.argv.slice(2);
const parsed = JSON.parse(readFileSync(notesPath, "utf8"));
for (const element of Object.values(parsed.elements)) element.comments = [];
const notes = JSON.stringify(parsed);
const stub = `<script>
try { sessionStorage.clear(); } catch {}
window.__walkthroughNotes = ${notes.trim()};
const realFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const url = new URL(input instanceof Request ? input.url : String(input), location.href);
  if (!url.pathname.startsWith("/__mock/")) return realFetch(input, init);
  if ((init.method ?? "GET") !== "GET") return new Response("{}", { status: 200 });
  return new Response(JSON.stringify(window.__walkthroughNotes), { status: 200, headers: { "content-type": "application/json" } });
};
window.EventSource = class { close() {} };
</script>
<script src="shell.js"></script>`;
let html = readFileSync(mockPath, "utf8");
html = html
  .replace('<script src="/__mock/shell.js"></script>', stub)
  .replace("<main data-mock-root>", '<main data-mock-root="SymbolSearch">');
if (!html.includes('src="shell.js"') || !html.includes('data-mock-root="SymbolSearch"')) {
  throw new Error("harness markers not found");
}
writeFileSync(outPath, html);
