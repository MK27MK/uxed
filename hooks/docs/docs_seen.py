#!/usr/bin/env python3
"""Mark the session as one that has read Claude Code's documentation, which lifts the block of `hooks/docs/docs.py`.

`PostToolUse` on `WebFetch|Bash|Agent`: a WebFetch or Bash command (such as `curl`) that names code.claude.com/docs,
or a finished run of the `claude-code-guide` agent, writes the session marker that `docs.py` checks. These are the
three ways its denial names. An Agent call that sends the guide to the background returns before the guide has read
anything, with `tool_response.status` set to `async_launched`, so it marks nothing; `SubagentStop` on
`claude-code-guide` marks that run when it finishes.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from docs import DOCS, marker  # noqa: E402

GUIDE = "claude-code-guide"


def main() -> None:
    event = json.load(sys.stdin)
    tool_input = event.get("tool_input") or {}
    response = event.get("tool_response")
    if event.get("hook_event_name") == "SubagentStop":
        read = event.get("agent_type") == GUIDE
    else:
        read = (DOCS in str(tool_input.get("url", "")) or DOCS in str(tool_input.get("command", ""))
                or tool_input.get("subagent_type") == GUIDE and isinstance(response, dict)
                and response.get("status") == "completed")
    if read:
        path = marker(event["session_id"])
        path.parent.mkdir(parents=True, exist_ok=True)
        path.touch()


if __name__ == "__main__":
    main()
