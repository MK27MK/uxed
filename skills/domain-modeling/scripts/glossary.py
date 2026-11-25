#!/usr/bin/env python3
"""Serve a project's `GLOSSARY.md` as a page to review: terms in alphabetical order, edited in place, approved one by
one, commented on.

`glossary.py [open] [--root DIR] [--no-open]` starts a server for the git repository around DIR (the current
directory by default) in the background, or finds the one already running, and prints its address. The page writes
edits straight into `GLOSSARY.md` at the repository root, and keeps approvals and comments in `.glossary.json` next to
it.

An approval holds the exact text the user approved, so a term the agent changes afterwards shows as changed, with the
approved text beside it, until the user approves it again.

`glossary.py comments` prints the user's open comments as JSON lines; `glossary.py reply ID TEXT` answers one as the
agent and resolves it. Running servers are recorded under `$GLOSSARY_HOME`, by default
`${XDG_STATE_HOME:-~/.local/state}/glossary`. Standard library only, Python 3.9 or later.
"""

from __future__ import annotations

import argparse
import hashlib
import http.server
import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
PAGE = HERE / "glossary.html"
GLOSSARY = "GLOSSARY.md"
STATE = Path(".glossary.json")
SERVERS = Path(os.environ.get("GLOSSARY_HOME")
               or Path(os.environ.get("XDG_STATE_HOME") or Path.home() / ".local" / "state") / "glossary") / "servers"
IDLE_SECONDS = 30 * 60

TERM = re.compile(r"^\*\*(?P<name>[^*\n]+?)\*\*:[ \t]*(?P<rest>.*)$")
AVOID = re.compile(r"^_Avoid_:[ \t]*(?P<rest>.*)$")
ALIASES = re.compile(r"^_Alias(?:es)?_:[ \t]*(?P<rest>.*)$")
HEADING = re.compile(r"^(?P<hashes>#{1,6})[ \t]+(?P<text>.*?)[ \t]*#*[ \t]*$")


# ---------------------------------------------------------------------------------------------------------------------
# GLOSSARY.md: parsed into the lines around the terms and the terms themselves, so an untouched term is written back
# byte for byte.

class Term:
    def __init__(self, name: str, definition: str, avoid: str, section: str, raw: list[str], aliases: str = "") -> None:
        self.name, self.definition, self.avoid, self.section, self.raw = name, definition, avoid, section, raw
        self.aliases = aliases

    @property
    def hash(self) -> str:
        return hashlib.sha256("\n".join(self.raw).encode()).hexdigest()[:16]

    def text(self) -> dict:
        return {"name": self.name, "aliases": self.aliases, "definition": self.definition, "avoid": self.avoid}

    def names(self) -> list[str]:
        """The name and each alias, the words that may stand for this term."""
        return [self.name, *split(self.aliases)]


def split(words: str) -> list[str]:
    return [w.strip() for w in words.split(",") if w.strip()]


def render(name: str, definition: str, avoid: str, aliases: str = "") -> list[str]:
    lines = [f"**{name}**:"]
    if aliases.strip():
        lines.append(f"_Aliases_: {aliases.strip()}")
    lines.extend(definition.strip().splitlines())
    if avoid.strip():
        lines.append(f"_Avoid_: {avoid.strip()}")
    return lines


def parse(source: str) -> list:
    """The file as a list whose items are either a line of text (str) or a Term."""
    lines = source.split("\n")
    items: list = []
    section = ""
    i = 0
    while i < len(lines):
        line = lines[i]
        heading = HEADING.match(line)
        if heading and len(heading["hashes"]) >= 2:
            section = heading["text"]
        start = TERM.match(line)
        if not start:
            items.append(line)
            i += 1
            continue
        block = [line]
        i += 1
        while i < len(lines) and lines[i].strip() and not TERM.match(lines[i]) and not HEADING.match(lines[i]):
            block.append(lines[i])
            i += 1
        # `_Aliases_:` is one line; `_Avoid_:` runs to the end of the block, as it always has. Every other line is the
        # definition.
        definition: list[str] = [start["rest"]] if start["rest"].strip() else []
        fields: dict[str, list[str]] = {"aliases": [], "avoid": []}
        for extra in block[1:]:
            avoid, aliases = AVOID.match(extra), ALIASES.match(extra)
            if aliases and not fields["avoid"]:
                fields["aliases"].append(aliases["rest"])
            elif avoid or fields["avoid"]:
                fields["avoid"].append(avoid["rest"] if avoid else extra.strip())
            else:
                definition.append(extra)
        items.append(Term(start["name"].strip(), "\n".join(definition).strip(), " ".join(fields["avoid"]).strip(), section,
                          block, ", ".join(fields["aliases"]).strip()))
    return items


def serialize(items: list) -> str:
    out: list[str] = []
    for item in items:
        out.extend(item.raw if isinstance(item, Term) else [item])
    return "\n".join(out)


def terms(items: list) -> list[Term]:
    return [item for item in items if isinstance(item, Term)]


def insert(items: list, term: Term, section: str) -> None:
    """Put a new term after the last term of its section, or the last term of the file, or at the end."""
    all_terms = terms(items)
    anchor = next((t for t in reversed(all_terms) if t.section == section), all_terms[-1] if all_terms else None)
    if anchor is not None:
        term.section = anchor.section
        at = items.index(anchor) + 1
        items[at:at] = ["", term]
        return
    while items and items[-1] == "":
        items.pop()
    headings = [HEADING.match(i) for i in items if isinstance(i, str)]
    sections = [h["text"] for h in headings if h and len(h["hashes"]) >= 2]
    if not sections:
        items.extend(["", "## Language"])
        sections = ["Language"]
    term.section = sections[-1]
    items.extend(["", term, ""])


def remove(items: list, term: Term) -> None:
    at = items.index(term)
    del items[at]
    if at < len(items) and items[at] == "" and at > 0 and items[at - 1] == "":
        del items[at]
    elif at > 0 and items[at - 1] == "" and (at == len(items) or items[at] == ""):
        del items[at - 1]


def normal(text: dict) -> dict:
    return {k: re.sub(r"\s+", " ", text.get(k) or "").strip() for k in ("name", "aliases", "definition", "avoid")}


# ---------------------------------------------------------------------------------------------------------------------
# The project: the glossary file and the review state beside it.

def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Conflict(Exception):
    pass


class Invalid(Exception):
    pass


class Project:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.path = root / GLOSSARY
        self.state_path = root / STATE
        self.lock = threading.Lock()

    def read(self) -> list:
        if not self.path.exists():
            return [f"# {self.root.name}", "", "## Language", ""]
        return parse(self.path.read_text(encoding="utf-8"))

    def write(self, items: list) -> None:
        atomic(self.path, serialize(items))

    def state(self) -> dict:
        try:
            state = json.loads(self.state_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            state = {}
        state.setdefault("approved", {})
        state.setdefault("comments", [])
        return state

    def save_state(self, state: dict) -> None:
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        atomic(self.state_path, json.dumps(state, indent=2, ensure_ascii=False) + "\n")

    def version(self) -> str:
        parts = []
        for path in (self.path, self.state_path):
            try:
                stat = path.stat()
                parts.append(f"{stat.st_mtime_ns}:{stat.st_size}")
            except OSError:
                parts.append("-")
        return "/".join(parts)

    def snapshot(self) -> dict:
        items, state = self.read(), self.state()
        out = []
        for term in terms(items):
            approved = state["approved"].get(term.name)
            if approved is None:
                status = "new"
            elif normal(approved) == normal(term.text()):
                status = "approved"
            else:
                status = "changed"
            out.append({**term.text(), "section": term.section, "hash": term.hash, "status": status,
                        "approved": approved if status == "changed" else None,
                        "comments": [c for c in state["comments"] if c["term"] == term.name]})
        sections = []
        for term in out:
            if term["section"] not in sections:
                sections.append(term["section"])
        return {"project": self.root.name, "path": str(self.path), "version": self.version(),
                "sections": sections, "terms": out}

    def find(self, items: list, name: str, base: str | None) -> Term:
        term = next((t for t in terms(items) if t.name == name), None)
        if term is None or (base is not None and term.hash != base):
            raise Conflict(f"{name} changed in {GLOSSARY} since the page loaded it")
        return term

    def save(self, body: dict) -> None:
        name = (body.get("name") or "").strip()
        definition = (body.get("definition") or "").strip()
        avoid = re.sub(r"\s+", " ", body.get("avoid") or "").strip()
        aliases = ", ".join(split(re.sub(r"\s+", " ", body.get("aliases") or "")))
        if not name or "*" in name or "\n" in name:
            raise Invalid("a term needs a name, without asterisks or line breaks")
        if any(a.casefold() == name.casefold() for a in split(aliases)):
            raise Invalid(f"{name} is the term's name, not an alias of it")
        if not definition:
            raise Invalid("a term needs a definition")
        with self.lock:
            items, state = self.read(), self.state()
            old = body.get("old_name")
            for word in [name, *split(aliases)]:
                other = next((t for t in terms(items) if t.name != old
                              and word.casefold() in (n.casefold() for n in t.names())), None)
                if other is not None:
                    raise Invalid(f"{word} is already in the glossary" + ("" if other.name.casefold() == word.casefold()
                                                                          else f", as an alias of {other.name}"))
            new = Term(name, definition, avoid, body.get("section") or "", render(name, definition, avoid, aliases), aliases)
            if old:
                term = self.find(items, old, body.get("base"))
                new.section = term.section
                items[items.index(term)] = new
                if old != name:
                    state["approved"].pop(old, None)
                    for comment in state["comments"]:
                        if comment["term"] == old:
                            comment["term"] = name
            else:
                insert(items, new, new.section)
            if body.get("approve", True):
                state["approved"][name] = new.text()
            self.write(items)
            self.save_state(state)

    def delete(self, body: dict) -> None:
        with self.lock:
            items, state = self.read(), self.state()
            term = self.find(items, body.get("name") or "", body.get("base"))
            remove(items, term)
            state["approved"].pop(term.name, None)
            state["comments"] = [c for c in state["comments"] if c["term"] != term.name]
            self.write(items)
            self.save_state(state)

    def approve(self, body: dict) -> None:
        with self.lock:
            items, state = self.read(), self.state()
            term = self.find(items, body.get("name") or "", body.get("base"))
            if body.get("approved", True):
                state["approved"][term.name] = term.text()
            else:
                state["approved"].pop(term.name, None)
            self.save_state(state)

    def comment(self, body: dict, by: str = "user") -> dict:
        text = (body.get("text") or "").strip()
        if not text:
            raise Invalid("a comment needs text")
        with self.lock:
            state = self.state()
            name = body.get("term") or ""
            if not any(t.name == name for t in terms(self.read())):
                raise Invalid(f"{name} is not in the glossary")
            comment = {"id": uuid.uuid4().hex[:8], "term": name, "by": by, "text": text, "at": now(),
                       "resolved": False}
            state["comments"].append(comment)
            self.save_state(state)
            return comment

    def resolve(self, body: dict) -> None:
        with self.lock:
            state = self.state()
            comment = next((c for c in state["comments"] if c["id"] == body.get("id")), None)
            if comment is None:
                raise Invalid("no such comment")
            if body.get("delete"):
                state["comments"].remove(comment)
            else:
                comment["resolved"] = bool(body.get("resolved", True))
            self.save_state(state)

    def reply(self, comment_id: str, text: str) -> dict:
        with self.lock:
            state = self.state()
            target = next((c for c in state["comments"] if c["id"] == comment_id), None)
        if target is None:
            raise Invalid(f"no comment {comment_id}")
        answer = self.comment({"term": target["term"], "text": text}, by="agent")
        self.resolve({"id": comment_id})
        return answer


def atomic(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.")
    with os.fdopen(handle, "w", encoding="utf-8", newline="") as f:
        f.write(text)
    umask = os.umask(0)
    os.umask(umask)
    os.chmod(tmp, path.stat().st_mode & 0o777 if path.exists() else 0o666 & ~umask)
    os.replace(tmp, path)


# ---------------------------------------------------------------------------------------------------------------------
# The server.

class Handler(http.server.BaseHTTPRequestHandler):
    project: Project
    last_seen = [time.time()]

    def log_message(self, format: str, *args) -> None:
        pass

    def send(self, status: int, body: bytes, kind: str = "application/json") -> None:
        self.send_response(status)
        self.send_header("Content-Type", f"{kind}; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def json(self, status: int, data) -> None:
        self.send(status, json.dumps(data, ensure_ascii=False).encode())

    def local(self) -> bool:
        host = (self.headers.get("Host") or "").rsplit(":", 1)[0]
        return host in {"127.0.0.1", "localhost"}

    def do_GET(self) -> None:
        self.last_seen[0] = time.time()
        if not self.local():
            return self.send(403, b"forbidden", "text/plain")
        path = self.path.split("?", 1)[0]
        if path == "/":
            return self.send(200, PAGE.read_bytes(), "text/html")
        if path == "/api/ping":
            return self.json(200, {"root": str(self.project.root), "pid": os.getpid()})
        if path == "/api/glossary":
            return self.json(200, self.project.snapshot())
        if path == "/api/version":
            return self.json(200, {"version": self.project.version()})
        self.send(404, b"not found", "text/plain")

    def do_POST(self) -> None:
        self.last_seen[0] = time.time()
        # A page on another site can post here too; only this page's own requests carry this header.
        if not self.local() or self.headers.get("X-Glossary") != "1":
            return self.send(403, b"forbidden", "text/plain")
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
            action = {"/api/save": self.project.save, "/api/delete": self.project.delete,
                      "/api/approve": self.project.approve, "/api/comment": self.project.comment,
                      "/api/resolve": self.project.resolve}.get(self.path)
            if action is None:
                return self.send(404, b"not found", "text/plain")
            action(body)
        except Conflict as error:
            return self.json(409, {"error": str(error)})
        except (Invalid, ValueError) as error:
            return self.json(400, {"error": str(error)})
        self.json(200, self.project.snapshot())


def record(root: Path) -> Path:
    return SERVERS / (hashlib.sha256(str(root).encode()).hexdigest()[:16] + ".json")


def running(root: Path) -> str | None:
    try:
        url = json.loads(record(root).read_text())["url"]
        with urllib.request.urlopen(url + "api/ping", timeout=2) as response:
            if json.load(response)["root"] == str(root):
                return url
    except Exception:
        pass
    return None


def serve(root: Path, port: int) -> None:
    Handler.project = Project(root)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler)
    url = f"http://127.0.0.1:{server.server_address[1]}/"
    SERVERS.mkdir(parents=True, exist_ok=True)
    record(root).write_text(json.dumps({"url": url, "pid": os.getpid(), "root": str(root)}))
    print(url, flush=True)
    # The parent reads stderr only until the address arrives; later output would go to a closed pipe.
    quiet = os.open(os.devnull, os.O_WRONLY)
    os.dup2(quiet, 1)
    os.dup2(quiet, 2)

    def watch() -> None:
        while time.time() - Handler.last_seen[0] < IDLE_SECONDS:
            time.sleep(30)
        server.shutdown()

    threading.Thread(target=watch, daemon=True).start()
    try:
        server.serve_forever()
    finally:
        record(root).unlink(missing_ok=True)


def git_root(start: Path) -> Path:
    try:
        out = subprocess.run(["git", "-C", str(start), "rev-parse", "--show-toplevel"],
                             capture_output=True, text=True, check=True).stdout.strip()
        return Path(out).resolve()
    except (OSError, subprocess.CalledProcessError):
        return start.resolve()


def again(root: Path) -> str:
    """The command that opens this glossary."""
    return f"python3 {Path(__file__).resolve()} open --root {root}"


def failed(reason: str) -> int:
    # A skill's `!` command that exits non-zero aborts the skill, so the agent would never read the reason; a person
    # at a terminal gets a failing exit code instead.
    print(f"Could not start the glossary server: {reason}")
    return 1 if sys.stdout.isatty() else 0


def start(root: Path, open_browser: bool) -> int:
    url = running(root)
    if url is None:
        try:
            probe = socket.socket()
            probe.bind(("127.0.0.1", 0))
            probe.close()
        except OSError as error:
            if os.environ.get("CLAUDECODE"):
                return failed(f"binding a local port failed ({error}). Claude Code's sandbox blocks this unless "
                              "sandbox.network.allowLocalBinding is true; run this command outside the sandbox: "
                              f"{again(root)}")
            return failed(f"this machine refused a port on 127.0.0.1 ({error}); a firewall or a security tool may "
                          "block local servers")
        child = subprocess.Popen([sys.executable, str(Path(__file__).resolve()), "_serve", "--root", str(root)],
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE, stdin=subprocess.DEVNULL,
                                 start_new_session=True, text=True)
        url = (child.stdout.readline() if child.stdout else "").strip()
        if not url:
            reason = (child.stderr.read() if child.stderr else "").strip().splitlines()
            return failed(f"the server exited before giving an address ({reason[-1] if reason else 'no output'}); "
                          f"run {again(root)} again, or python3 {Path(__file__).resolve()} _serve --root {root} to see it fail")
        if child.stderr:
            child.stderr.close()
    print(f"Glossary of {root.name}: {url}")
    if open_browser:
        import webbrowser
        webbrowser.open(url)
    return 0


def main(argv: list[str]) -> int:
    if argv[:1] == ["_serve"]:
        serve(git_root(Path(argv[argv.index("--root") + 1]) if "--root" in argv else Path.cwd()),
              int(argv[argv.index("--port") + 1]) if "--port" in argv else 0)
        return 0
    if not argv or argv[0].startswith("-") and argv[0] not in ("-h", "--help"):
        argv = ["open", *argv]
    parser = argparse.ArgumentParser(prog="glossary.py", description=(__doc__ or "").split("\n\n")[0])
    where = argparse.ArgumentParser(add_help=False)
    where.add_argument("--root", type=Path, default=Path.cwd(), metavar="DIR",
                       help="a folder of the repository whose glossary to use (default: the current directory)")
    commands = parser.add_subparsers(dest="command", metavar="{open,comments,reply}")
    opening = commands.add_parser("open", parents=[where], help="start or find the page's server and open it (default)",
                                  description="Start the glossary page's server for the repository in the background, "
                                  "or find the one already running, print its address and open it in the browser. "
                                  "The server stops after 30 minutes unused.")
    opening.add_argument("--no-open", action="store_true", help="print the address without opening a browser")
    commands.add_parser("comments", parents=[where], help="print the open comments the user left on the page",
                        description="Print the user's open comments on the page, one JSON line each, with the id "
                        "that reply takes.")
    replying = commands.add_parser("reply", parents=[where], help="answer a comment as the agent and resolve it",
                                   description="Post an answer under a comment and resolve the comment.")
    replying.add_argument("id", help="the comment's id, as comments prints it")
    replying.add_argument("text", help="the answer")
    options = parser.parse_args(argv)
    root = git_root(options.root)
    if options.command == "comments":
        project = Project(root)
        state = project.state()
        for comment in state["comments"]:
            if comment["by"] == "user" and not comment["resolved"]:
                print(json.dumps(comment, ensure_ascii=False))
        return 0
    if options.command == "reply":
        try:
            print(json.dumps(Project(root).reply(options.id, options.text), ensure_ascii=False))
        except Invalid as error:
            print(error, file=sys.stderr)
            return 1
        return 0
    return start(root, open_browser=not options.no_open and sys.stdout.isatty())


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
