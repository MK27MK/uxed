#!/usr/bin/env python3
"""Turns a Claude Code session transcript into a page the user comments on, message by message.

Reads a transcript (`~/.claude/projects/<project>/<session>.jsonl`), keeps the user's turns, the
agent's text and its tool calls with their results, and writes `session_page.html` filled with them.
The page saves each comment in the artifact's `comments` collection, one document per comment, which
the agent reads back with `ArtifactData`. Each comment is a sub-chat: the later turns, the agent's
answers and the user's follow-up questions, are documents in the `replies` collection.

    python3 session_page.py PATH.jsonl -o OUT.html
    python3 session_page.py --project ~/code/shop -o OUT.html                       # the latest session there
    python3 session_page.py --project ~/code/shop --grep "landing page" -o OUT.html  # the latest whose first prompt matches

The transcript format is internal to Claude Code and may change. Subagent transcripts are skipped.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

PROJECTS = Path.home() / ".claude" / "projects"
PAGE = Path(__file__).with_name("session_page.html")
# KaTeX 0.19.0's katex.min.css with its woff2 fonts embedded as data URIs, because an Artifact loads neither
# stylesheets nor fonts from a CDN; its version matches the page's KaTeX script.
KATEX_CSS = Path(__file__).with_name("katex.css")
REMINDER = re.compile(r"<system-reminder>.*?</system-reminder>", re.S)
# Messages that the app or a hook writes in the user's place, kept but marked.
SYSTEM = ("<command-name>", "<local-command", "<command-message>", "Caveat:", "<task-notification>",
          "<side-sessions-event>", "<cross-session-message", "<ci-monitor-event>", "<launch-selected",
          "<bash-stdout>", "<bash-stderr>")
COMMAND = re.compile(r"<command-name>(.*?)</command-name>", re.S)
ARGS = re.compile(r"<command-args>(.*?)</command-args>", re.S)
INPUT_CAP = 1500
RESULT_CAP = 3000


def entries(path: Path) -> list[dict]:
    """The transcript entries; a line that a live session is still writing is skipped."""
    parsed = []
    for line in path.read_text().splitlines():
        try:
            parsed.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return parsed


def project_dir(folder: str) -> Path:
    resolved = str(Path(folder).expanduser().resolve())
    return PROJECTS / re.sub(r"[^A-Za-z0-9]", "-", resolved)


def first_prompt(path: Path) -> str:
    with path.open() as lines:
        for line in lines:
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            if entry.get("type") == "queue-operation" and entry.get("content"):
                return entry["content"]
            if entry.get("type") == "user" and not entry.get("isMeta"):
                text = "\n".join(texts(entry["message"]["content"]))
                if text.strip():
                    return text
    return ""


def find_transcript(folder: str, grep: str | None) -> Path:
    candidates = sorted(project_dir(folder).glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True)
    for path in candidates:
        if grep is None or grep.lower() in first_prompt(path).lower():
            return path
    sys.exit(f"no transcript in {project_dir(folder)}" + (f" whose first prompt contains {grep!r}" if grep else ""))


def texts(content) -> list[str]:
    if isinstance(content, str):
        return [content]
    return [part.get("text", "") for part in content if part.get("type") == "text"]


def cap(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[:limit] + f"\n… [{len(text) - limit} characters cut]"


def result_text(content) -> str:
    if isinstance(content, str):
        return content
    parts = []
    for part in content or []:
        if part.get("type") == "text":
            parts.append(part["text"])
        elif part.get("type") == "image":
            parts.append("[image]")
    return "\n".join(parts)


def user_text(text: str) -> tuple[str, str]:
    """The role and text of a user entry: a slash command is the user's, shown as they typed it."""
    if command := COMMAND.search(text):
        args = ARGS.search(text)
        return "user", f"{command[1].strip()} {args[1].strip() if args else ''}".strip()
    return ("system" if text.startswith(SYSTEM) else "user"), text


def messages(path: Path) -> list[dict]:
    """The session in order: user turns, agent text, the agent's tool calls with their results."""
    items, calls = [], {}
    for entry in entries(path):
        if entry.get("isSidechain"):
            continue
        at = entry.get("timestamp", "")
        queued = entry.get("attachment") if entry.get("type") == "attachment" else None
        # A message the user sent while the agent was working reaches the transcript only as this attachment.
        if queued and queued.get("type") == "queued_command" and queued.get("origin", {}).get("kind") == "human":
            text = REMINDER.sub("", "\n".join(texts(queued.get("prompt") or ""))).strip()
            if text:
                items.append({"id": entry.get("uuid", f"queued-{len(items)}"), "role": "user", "text": text, "at": at})
            continue
        if entry.get("type") not in ("user", "assistant"):
            continue
        content = entry["message"]["content"]
        if entry.get("isCompactSummary"):
            # Claude Code writes a compaction summary as a user turn; the page shows it whole but collapsed.
            items.append({"id": entry["uuid"], "role": "summary", "at": at, "text": "\n".join(texts(content)).strip()})
            continue
        if entry["type"] == "user":
            if isinstance(content, list):
                for part in content:
                    if part.get("type") == "tool_result" and part.get("tool_use_id") in calls:
                        call = calls[part["tool_use_id"]]
                        call["result"] = cap(result_text(part.get("content")), RESULT_CAP)
                        call["error"] = bool(part.get("is_error"))
            if entry.get("isMeta"):
                continue
            text = REMINDER.sub("", "\n".join(texts(content))).strip()
            if text:
                role, text = user_text(text)
                items.append({"id": entry["uuid"], "role": role, "text": text, "at": at})
            continue
        for n, part in enumerate(content):
            if part.get("type") == "text" and part["text"].strip():
                items.append({"id": f"{entry['uuid']}-{n}", "role": "agent", "text": part["text"].strip(), "at": at})
            elif part.get("type") == "tool_use":
                call = {"id": part["id"], "role": "tool", "tool": part["name"], "at": at,
                        "input": cap(json.dumps(part.get("input"), ensure_ascii=False, indent=1), INPUT_CAP),
                        "result": None, "error": False}
                calls[part["id"]] = call
                items.append(call)
    for index, item in enumerate(items, 1):
        item["n"] = index
    return items


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("transcript", nargs="?", help="a session's .jsonl")
    parser.add_argument("--project", help="the session's working folder: takes its latest transcript")
    parser.add_argument("--grep", help="with --project: the latest transcript whose first prompt contains this text")
    parser.add_argument("-o", "--output", required=True)
    args = parser.parse_args()
    if args.transcript:
        path = Path(args.transcript).expanduser()
    elif args.project:
        path = find_transcript(args.project, args.grep)
    else:
        parser.error("give a transcript or --project")
    items = messages(path)
    session = {"id": path.stem, "project": path.parent.name, "title": first_prompt(path)[:80], "items": items}
    # Every "<" is escaped: otherwise a transcript containing "<!--" and "<script" would close the script early.
    data = json.dumps(session, ensure_ascii=False).replace("<", "\\u003c")
    page = PAGE.read_text().replace("/*KATEX_CSS*/", KATEX_CSS.read_text()).replace("/*SESSION*/null", data)
    Path(args.output).write_text(page)
    user = sum(1 for item in items if item["role"] == "user")
    print(f"{path}\n{len(items)} messages, {user} from the user -> {args.output}")


if __name__ == "__main__":
    main()
