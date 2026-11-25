#!/usr/bin/env python3
"""Record the teams this session has read or created an issue of, which lifts the block of `hooks/issue/issue.py`.

`PostToolUse` on the tracker's `get_issue` and `save_issue` tools: every issue identifier (`ENG-150`) in the tool's
input or response records its team, and so does the `team` passed to `save_issue`.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from issue import marker  # noqa: E402

IDENTIFIER = re.compile(r"\b([A-Z][A-Z0-9]*)-\d+\b")


def teams(event: dict) -> set[str]:
    tool_input = event.get("tool_input") or {}
    text = json.dumps(tool_input, ensure_ascii=False) + "\n" + json.dumps(event.get("tool_response"), ensure_ascii=False)
    found = set(IDENTIFIER.findall(text))
    team = tool_input.get("team") if isinstance(tool_input, dict) else None
    if isinstance(team, str) and team.strip():
        found.add(team.strip().upper())
    return found


def main() -> None:
    event = json.load(sys.stdin)
    if not re.search(r"(^|__)(get_issue|save_issue)$", str(event.get("tool_name", ""))):
        return
    for team in teams(event):
        path = marker(event["session_id"], team)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.touch()


if __name__ == "__main__":
    main()
