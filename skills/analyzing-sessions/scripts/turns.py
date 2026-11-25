#!/usr/bin/env python3
"""Extracts the user's turns from Claude Code's local transcripts since the last corrections report.

Prints one JSON object per line: the turn id, the folder the session started in, the session, the
time, the end of the agent's text before the turn, and the turn itself. A turn counts only when it
answers an agent reply, so a headless `claude -p` run (one prompt, no reply) produces nothing.
Interrupts are kept as `[interrupt]`. The model reads this output instead of whole transcripts.

The window starts after the last time on the first line of the newest report in
`~/.kulmine/corrections/` (the title `count.py` writes), or at `--since`, or 7 days ago.

Reads `~/.claude/projects/*/*.jsonl`. Their format is internal to Claude Code and may change; the
user's `cleanupPeriodDays` decides how long they are kept. Subagent transcripts, and sessions started
in a temporary folder (scripted runs and skill tests), are skipped: the user does not write in them.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

PROJECTS = Path.home() / ".claude" / "projects"
REPORTS = Path.home() / ".kulmine" / "corrections"
REPORT = re.compile(r"\d{4}-\d{2}-\d{2}(T\d{4})?\.md")
STAMP = re.compile(r"\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?")
TEMPORARY = re.compile(r"^/(private/)?(tmp|var/folders)/")
TAIL = 600
# Commands, shell lines and messages that the app or other sessions send in the user's place.
NOISE = ("<command-name>", "<local-command", "<command-message>", "Caveat:", "<task-notification>",
         "<side-sessions-event>", "<cross-session-message", "<ci-monitor-event>", "<launch-selected",
         "<bash-input>", "<bash-stdout>", "<bash-stderr>")
REMINDER = re.compile(r"<system-reminder>.*?</system-reminder>", re.S)


def moment(text: str) -> datetime:
    """An ISO date or time; a date is local midnight, a time without an offset is UTC."""
    when = datetime.fromisoformat(text.replace("Z", "+00:00"))
    if "T" not in text:
        return when.astimezone()
    return when if when.tzinfo else when.replace(tzinfo=timezone.utc)


def last_report_end() -> datetime | None:
    reports = sorted(path for path in REPORTS.glob("*.md") if REPORT.fullmatch(path.name))
    if not reports:
        return None
    with reports[-1].open() as report:
        stamps = STAMP.findall(report.readline())
    return moment(stamps[-1] if stamps else reports[-1].name[:10])


def texts(content) -> list[str]:
    if isinstance(content, str):
        return [content]
    return [part.get("text", "") for part in content if part.get("type") == "text"]


def user_text(entry: dict) -> str | None:
    if entry.get("type") != "user" or entry.get("isMeta") or entry.get("isSidechain"):
        return None
    text = REMINDER.sub("", "\n".join(texts(entry["message"]["content"]))).strip()
    if not text or text.startswith(NOISE):
        return None
    if text.startswith("[Request interrupted by user"):
        return "[interrupt]"
    return text


def turns(path: Path, since: datetime, seen: set[str]):
    agent = ""
    start = None
    for line in path.open():
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        start = start or entry.get("cwd")
        if start and TEMPORARY.match(start):
            return
        if entry.get("type") == "assistant" and not entry.get("isSidechain"):
            agent += "\n" + "\n".join(texts(entry["message"]["content"]))
            continue
        text = user_text(entry)
        if text is None:
            continue
        # A forked or resumed session copies the parent session's entries, with their uuids or with new ones.
        key = f"{agent.strip()[-TAIL:]}\0{text}"
        if entry.get("uuid") in seen or key in seen:
            agent = ""
            continue
        seen.update((entry.get("uuid"), key))
        stamp = entry.get("timestamp")
        if agent.strip() and stamp and moment(stamp) > since:
            yield {
                "id": entry.get("uuid"),
                "project": start or path.parent.name,
                "session": entry.get("sessionId", path.stem),
                "time": stamp,
                "agent": agent.strip()[-TAIL:],
                "user": text,
            }
        agent = ""


def main() -> None:
    parser = argparse.ArgumentParser(description="Extracts the user's turns since the last corrections report.")
    parser.add_argument("--since", type=moment, help="an ISO date or time, instead of the end of the newest report")
    args = parser.parse_args()
    since = args.since or last_report_end() or datetime.now(timezone.utc) - timedelta(days=7)
    seen: set[str] = set()
    for path in sorted(PROJECTS.glob("*/*.jsonl"), key=lambda p: p.stat().st_mtime):
        if datetime.fromtimestamp(path.stat().st_mtime, timezone.utc) < since:
            continue
        for turn in turns(path, since, seen):
            print(json.dumps(turn, ensure_ascii=False))


if __name__ == "__main__":
    sys.exit(main())
