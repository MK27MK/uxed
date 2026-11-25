#!/usr/bin/env python3
"""Block edits to Claude Code's configuration until this session has read Claude Code's documentation.

`PreToolUse` on `Edit|Write`: an edit to Claude Code's configuration is denied until `hooks/docs/docs_seen.py` has
marked the session as one that read the documentation. Configuration is recognized by its path after resolving
symlinks: `.md` and `.json` files under `.claude/`, `.json` files under `.claude-plugin/`, `hooks/hooks.json`,
`.mcp.json`, `CLAUDE.md`, `CLAUDE.local.md`, `SKILL.md`, and `.md` files in an `agents/` or `output-styles/` folder.
A `settings.json` or `plugin.json` elsewhere belongs to another tool. A file written by Bash is not checked.

Once the documentation has been read, every edit in the session passes: the check is that a page was read, not which
one.
"""

import json
import os
import re
import sys
from pathlib import Path

STATE = Path(os.environ.get("CLAUDE_PLUGIN_DATA") or Path.home() / ".kulmine") / "docs-read"
DOCS = "code.claude.com/docs"
# File names that belong to Claude Code: configuration wherever they are.
CONFIG_NAMES = {"SKILL.md", "CLAUDE.md", "CLAUDE.local.md", ".mcp.json"}
# Under `.claude/`, these hold work, memory or a list of dev servers, not configuration.
NOT_CONFIG = ("worktrees", "projects", "plans", "plugins", "launch.json")
DENY = (
    "{name} configures Claude Code, and this session has not read Claude Code's documentation. Remembered facts "
    "about Claude Code go stale, so first read the page that covers this file: fetch it from "
    "https://code.claude.com/docs/llms.txt with WebFetch or with `curl` in Bash, or ask the claude-code-guide agent. "
    "Check every field you will write against it, then retry the edit."
)


def is_config(file_path: str) -> bool:
    path = Path(os.path.realpath(file_path))
    if path.name in CONFIG_NAMES:
        return True
    parts = path.parts
    # Only what follows the last `.claude/worktrees/<name>/` belongs to the file being edited.
    for i in range(len(parts) - 2, -1, -1):
        if parts[i] == ".claude" and parts[i + 1] == "worktrees":
            parts = parts[i + 3:]
            break
    if ".claude" in parts:
        rest = parts[parts.index(".claude") + 1:]
        return bool(rest) and rest[0] not in NOT_CONFIG and path.suffix in {".md", ".json"}
    if path.suffix == ".json" and ".claude-plugin" in parts[:-1]:
        return True
    if parts[-2:] == ("hooks", "hooks.json"):
        return True
    return path.suffix == ".md" and any(p in {"agents", "output-styles"} for p in parts[:-1])


def marker(session: str) -> Path:
    return STATE / re.sub(r"[^\w-]", "_", session)


def main() -> None:
    event = json.load(sys.stdin)
    if marker(event["session_id"]).exists():
        return
    file_path = str((event.get("tool_input") or {}).get("file_path", ""))
    if file_path and is_config(file_path):
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": DENY.format(name=Path(file_path).name),
        }}))


if __name__ == "__main__":
    main()
