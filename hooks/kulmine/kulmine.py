#!/usr/bin/env python3
"""Keep the kulmine style in the agent's context for the whole session.

The text is the output style `output-styles/kulmine.md`, which the plugin forces on the main session and which stays
in the system prompt even after compaction. This script carries it where the output style does not reach, chosen by
`hook_event_name`:

- `SubagentStart`: injects the whole style into every subagent, which has a system prompt of its own.
- `UserPromptSubmit`: on every user message injects the thesis, the style's first paragraph, so the rules stay close
  to the reply they govern and the thesis cannot drift from the text.

Silent with `KULMINE_STYLE=off`.
"""

import json
import os
import sys
from pathlib import Path

TEXT = Path(__file__).resolve().parents[2] / "output-styles" / "kulmine.md"
EVENTS = {"SubagentStart", "UserPromptSubmit"}


def body(text: str) -> str:
    """The text without the output style's frontmatter."""
    if text.startswith("---\n"):
        end = text.find("\n---\n", 4)
        if end != -1:
            return text[end + 5:]
    return text


def thesis(text: str) -> str:
    """The first paragraph after the heading."""
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip() and not p.lstrip().startswith("#")]
    return paragraphs[0] if paragraphs else ""


def context(event: str, text: str) -> str:
    if event == "UserPromptSubmit":
        return "kulmine style active. " + thesis(text)
    return text.strip()


def main() -> None:
    if os.environ.get("KULMINE_STYLE") == "off":
        return
    try:
        event = json.load(sys.stdin).get("hook_event_name", "")
        text = body(TEXT.read_text(encoding="utf-8"))
    except (OSError, ValueError, AttributeError):
        return
    if event not in EVENTS:
        return
    out = {"hookSpecificOutput": {"hookEventName": event, "additionalContext": context(event, text)}}
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
