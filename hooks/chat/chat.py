#!/usr/bin/env python3
"""Send the agent back to rewrite a final message that runs past one sentence in chat.

`Stop`: reads the agent's last message and, if it contains a list, a heading, a table, more than one sentence per
block or a long code block, blocks the end of the turn with a reason that asks to move the content into a
`kulmine:pages` page (or condense it into one sentence) and leave one sentence in chat. Allowed: links, `>` quotes
(one answering sentence under each) and code blocks up to `MAX_CODE_LINES` lines.

The message is read from `last_assistant_message` or, when missing, from the transcript: the agent's text blocks
after the last tool call. With `stop_hook_active` it does not block again, so a second wrong attempt does not become
a loop. Silent with `KULMINE_STYLE=off`.
"""

import json
import os
import re
import sys

MAX_CODE_LINES = 3
MAX_CHARS = 350

FENCE = re.compile(r"^```.*?^```[ \t]*$", re.M | re.S)
INLINE_CODE = re.compile(r"`[^`\n]*`")
URL = re.compile(r"https?://\S+|\]\([^)]*\)")
LIST = re.compile(r"^\s*(?:[-*+•]|\d+[.)])\s+\S")
HEADING = re.compile(r"^\s*#{1,6}\s")
TABLE = re.compile(r"^\s*\|.*\|\s*$")
# End of sentence: punctuation followed by a space and a capital letter, a digit or an opening mark.
SENTENCE_END = re.compile(r"[.!?…]+[\"'»)]*\s+(?=[A-ZÀ-ÖØ-Þ0-9\"'«(*_])")

REASON = (
    "kulmine: your last chat message {problem}. Chat takes at most one sentence of prose (plus the link, a "
    "one-line command, or `>` quotes with one sentence under each). If what matters fits in one sentence, rewrite "
    "it that way; otherwise move the content into a page with `kulmine:pages` (or the fitting skill: interview-me, "
    "teaching, prototyping, researching), publish it and close with a single sentence: the result or the decision "
    "you are waiting for, with the link. Do not apologize and do not repeat the text."
)


def problems(text: str) -> list[str]:
    found = []
    for block in FENCE.findall(text):
        if len(block.strip().splitlines()) - 2 > MAX_CODE_LINES:
            found.append(f"has a code block longer than {MAX_CODE_LINES} lines")
            break
    prose = FENCE.sub("", text)
    lines = prose.splitlines()
    if any(LIST.match(l) for l in lines):
        found.append("contains a list")
    if any(HEADING.match(l) for l in lines):
        found.append("contains a heading")
    if any(TABLE.match(l) for l in lines):
        found.append("contains a table")
    # Prose blocks are separated by quotes: one sentence is allowed under each quote.
    blocks, current = [], []
    for line in lines:
        if line.lstrip().startswith(">"):
            blocks.append(" ".join(current))
            current = []
        else:
            current.append(line.strip())
    blocks.append(" ".join(current))
    for block in blocks:
        clean = URL.sub("L", INLINE_CODE.sub("C", block)).strip()
        if not clean:
            continue
        if len(SENTENCE_END.findall(clean)) >= 1:
            found.append("has more than one sentence")
            break
        if len(clean) > MAX_CHARS:
            found.append(f"has a sentence longer than {MAX_CHARS} characters")
            break
    return found


def last_message(event: dict) -> str:
    text = event.get("last_assistant_message")
    if isinstance(text, str):
        return text
    path = event.get("transcript_path")
    if not path:
        return ""
    try:
        with open(path, encoding="utf-8") as f:
            entries = [json.loads(l) for l in f if l.strip()]
    except (OSError, ValueError):
        return ""
    parts = []
    for entry in reversed(entries):
        content = (entry.get("message") or {}).get("content")
        if entry.get("type") == "user":
            break
        if entry.get("type") != "assistant" or not isinstance(content, list):
            continue
        if any(b.get("type") == "tool_use" for b in content):
            break
        parts.extend(b.get("text", "") for b in reversed(content) if b.get("type") == "text")
    return "\n\n".join(reversed(parts))


def main() -> None:
    if os.environ.get("KULMINE_STYLE") == "off":
        return
    try:
        event = json.load(sys.stdin)
    except ValueError:
        return
    if not isinstance(event, dict) or event.get("stop_hook_active"):
        return
    found = problems(last_message(event))
    if found:
        reason = REASON.format(problem=", ".join(found))
        print(json.dumps({"decision": "block", "reason": reason}, ensure_ascii=False))


if __name__ == "__main__":
    main()
