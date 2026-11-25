#!/usr/bin/env python3
"""Make the agent open the issue at the start of a piece of work in a project with an issue tracker, and block edits
without one.

`UserPromptSubmit`: if the session folder is in a project with a tracker, on every user message reminds the agent that
new work starts from its issue, before exploring, planning or writing pages; until the session has an issue of the
team, the reminder says so.

`PreToolUse` on `Edit|Write`, the net for what the reminder did not stop: the file's project is the nearest folder,
walking up from the file, that contains `.kulmine/config.json`; if its config has a `tracker`, the edit is denied
until the session has read or created an issue of its team (recorded by `hooks/issue/issue_seen.py`) or the file's
branch is the branch of an issue of the team (`<user>/eng-150-...`). The file's project counts, not the session
folder: a session opened in a project without a tracker that edits a project with one is stopped all the same.

Files under `.kulmine/` (the working copies of pages), projects without a tracker and files written by Bash are not
checked.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

STATE = Path(os.environ.get("CLAUDE_PLUGIN_DATA") or Path.home() / ".kulmine") / "issues"
REMIND_NONE = (
    "{project} tracks its work in {kind} (team {team}) and this session has no {team} issue yet. If this message "
    "asks for work (feature, fix, refactor, spec, plan, research, prototype), your first move, before exploring the "
    "code, planning or writing a page, is to find or open its issue with `kulmine:tracking` and move it to In "
    "Progress."
)
REMIND_SOME = (
    "{project} tracks its work in {kind} (team {team}). If this message starts work different from the issue you "
    "are on, your first move is to find or open its issue with `kulmine:tracking`, before exploring, planning or "
    "editing."
)
DENY = (
    "{project} tracks its work in {kind} (team {team}) and this session has no {team} issue yet: it should have been "
    "opened at the start of the work, open it now. Before editing {name}, follow the `kulmine:tracking` skill: search "
    "with `list_issues` for the issue that covers this work, open it with `save_issue` if missing, move it to In "
    "Progress and work on its `gitBranchName`. Then retry the edit."
)


def project(start: Path) -> Path | None:
    """The nearest folder, from `start` upwards, that has `.kulmine/config.json`."""
    for folder in (start, *start.parents):
        if (folder / ".kulmine" / "config.json").is_file():
            return folder
    return None


def tracker(root: Path) -> dict | None:
    try:
        data = json.loads((root / ".kulmine" / "config.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    tracker = data.get("tracker") if isinstance(data, dict) else None
    if isinstance(tracker, dict) and tracker.get("kind") and tracker.get("team"):
        return tracker
    return None


def marker(session: str, team: str) -> Path:
    return STATE / re.sub(r"[^\w-]", "_", session) / re.sub(r"[^\w-]", "_", team.upper())


def on_issue_branch(folder: Path, team: str) -> bool:
    try:
        branch = subprocess.run(["git", "-C", str(folder), "branch", "--show-current"],
                                capture_output=True, text=True, timeout=3).stdout
    except (OSError, subprocess.SubprocessError):
        return False
    return re.search(rf"(^|[/_-]){re.escape(team.lower())}-\d+(\D|$)", branch.strip().lower()) is not None


def remind(event: dict) -> None:
    cwd = event.get("cwd")
    root = project(Path(os.path.realpath(cwd))) if cwd else None
    config = tracker(root) if root else None
    if config is None:
        return
    team = str(config["team"])
    has = marker(event["session_id"], team).exists() or on_issue_branch(root, team)
    text = (REMIND_SOME if has else REMIND_NONE).format(project=root.name, kind=str(config["kind"]).capitalize(),
                                                        team=team)
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": text}},
                     ensure_ascii=False))


def gate(event: dict) -> None:
    file_path = str((event.get("tool_input") or {}).get("file_path", ""))
    if not file_path:
        return
    path = Path(os.path.realpath(file_path))
    root = project(path.parent)
    if root is None:
        return
    config = tracker(root)
    if config is None:
        return
    if (root / ".kulmine") in path.parents:
        return
    team = str(config["team"])
    if marker(event["session_id"], team).exists():
        return
    folder = path.parent if path.parent.is_dir() else root
    if on_issue_branch(folder, team):
        return
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": DENY.format(project=root.name, kind=str(config["kind"]).capitalize(), team=team,
                                                name=path.name),
    }}, ensure_ascii=False))


def main() -> None:
    event = json.load(sys.stdin)
    if event.get("hook_event_name") == "UserPromptSubmit":
        remind(event)
    else:
        gate(event)

if __name__ == "__main__":
    main()
