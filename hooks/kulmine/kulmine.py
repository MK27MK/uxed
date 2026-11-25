#!/usr/bin/env python3
"""Keep the kulmine style in the agent's context for the whole session.

The text is the output style `output-styles/kulmine.md`, which the plugin forces on the main session and which stays
in the system prompt even after compaction. This script carries it where the output style does not reach, chosen by
`hook_event_name`:

- `SubagentStart`: injects the whole style into every subagent, which has a system prompt of its own.
- `UserPromptSubmit`: on every user message injects the thesis, the style's first paragraph, so the rules stay close
  to the reply they govern and the thesis cannot drift from the text.

Both events also carry the project's three languages (`language` in `.kulmine/config.json`, read by `pages.py`), so
the agent writes issues, committed work and chat each in its own.

Silent with `KULMINE_STYLE=off`.
"""

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TEXT = ROOT / "output-styles" / "kulmine.md"
sys.path.insert(0, str(ROOT / "skills" / "pages" / "scripts"))
import pages  # noqa: E402
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


def project(start: Path) -> Path:
    """The nearest folder, from `start` upwards, with `.kulmine/config.json`; `start` itself when there is none."""
    for folder in (start, *start.parents):
        if (folder / ".kulmine" / "config.json").is_file():
            return folder
    return start


def languages(cwd: Path) -> str:
    try:
        lang = pages.config(project(cwd))["language"]
    except (OSError, ValueError):
        lang = pages.LANGUAGES
    chat = "the language of the user's last message" if lang["chat"] == "adaptive" else f'`{lang["chat"]}`'
    return (f"Languages: chat, pages and Artifacts in {chat}; issue tracker (titles, descriptions, comments) in "
            f'`{lang["tracker"]}`; produced work (code, comments, docs, commits, PRs) in `{lang["work"]}`.')


def context(event: str, text: str, cwd: Path) -> str:
    if event == "UserPromptSubmit":
        return "kulmine style active. " + thesis(text) + "\n\n" + languages(cwd)
    return text.strip() + "\n\n" + languages(cwd)


def main() -> None:
    if os.environ.get("KULMINE_STYLE") == "off":
        return
    try:
        payload = json.load(sys.stdin)
        event = payload.get("hook_event_name", "")
        cwd = Path(payload.get("cwd") or os.getcwd())
        text = body(TEXT.read_text(encoding="utf-8"))
    except (OSError, ValueError, AttributeError):
        return
    if event not in EVENTS:
        return
    out = {"hookSpecificOutput": {"hookEventName": event, "additionalContext": context(event, text, cwd)}}
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
