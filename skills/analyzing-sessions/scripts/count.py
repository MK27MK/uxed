#!/usr/bin/env python3
"""Builds a corrections report from the turns of `turns.py` and the labels the user confirmed.

    python3 count.py TURNS.jsonl LABELS.jsonl > ~/.kulmine/corrections/YYYY-MM-DD.md

A label is one JSON line per correction: `{"id": <turn id>, "family": <code>, "words": <the user's
words, copied from the turn>, "quote": <those words in English>, "did": <what the agent had done,
optional>}`. A family is the code that opens a row of the families table in `common-ai-errors.md`,
like `BEH.REP` in a row starting with "| `BEH.REP` |", or `other`. Prints the title, the summary line,
one row per family in the order of `common-ai-errors.md`, and the list of corrections. When a label
is wrong it prints nothing on stdout, reports every wrong label on stderr and exits with 1: an unknown
turn or family, a repeated turn, words that are not in the user's turn, or a quote that is empty or
longer than 20 words. When `common-ai-errors.md` has no family rows it says so and exits with 1.
"""

import argparse
import json
import re
import sys
from pathlib import Path

MISTAKES = Path(__file__).resolve().parents[3] / "docs" / "common-ai-errors.md"
FAMILY = re.compile(r"^\|\s*`([A-Z]+\.[A-Z]+)`\s*\|", re.M)
QUOTE_WORDS = 20


def lines(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def squeeze(text: str) -> str:
    return " ".join(text.split())


def families(mistakes: Path) -> list[str]:
    """The family codes of `common-ai-errors.md`, in the order of its table."""
    return list(dict.fromkeys(FAMILY.findall(mistakes.read_text())))


def problems(labels: list[dict], turns: dict[str, dict], families: list[str]) -> list[str]:
    found, seen = [], set()
    for n, label in enumerate(labels, 1):
        quote = squeeze(str(label.get("quote", "")))
        words = squeeze(str(label.get("words", "")))
        if label.get("id") not in turns:
            found.append(f"label {n}: no turn has the id {label.get('id')!r}.")
        elif not words or words not in squeeze(turns[label["id"]]["user"]):
            found.append(f"label {n}: the words {words!r} are not in the user's turn; copy them exactly.")
        if label.get("id") in seen:
            found.append(f"label {n}: turn {label.get('id')} is labelled twice; give it one family.")
        if label.get("family") not in families:
            found.append(f"label {n}: {label.get('family')!r} is not a family in common-ai-errors.md, nor `other`.")
        if not quote:
            found.append(f"label {n}: the quote is empty; give the user's words in English.")
        if len(quote.split()) > QUOTE_WORDS:
            found.append(f"label {n}: the quote is {len(quote.split())} words, over {QUOTE_WORDS}; shorten it.")
        seen.add(label.get("id"))
    return found


def report(labels: list[dict], turns: dict[str, dict], families: list[str]) -> str:
    times = sorted(turn["time"] for turn in turns.values())
    sessions = {turn["session"] for turn in turns.values()}
    out = [f"# Corrections, {times[0]} to {times[-1]}" if times else "# Corrections", "",
           f"{len(turns)} user turns in {len(sessions)} sessions; {len(labels)} corrections.", "",
           "| Family | Corrections | Sessions |", "|---|---|---|"]
    for family in families:
        mine = [turns[label["id"]] for label in labels if label["family"] == family]
        out.append(f"| {family} | {len(mine)} | {len({turn['session'] for turn in mine})} |")
    out += ["", "## Corrections", ""]
    for label in labels:
        turn = turns[label["id"]]
        project = Path(re.sub(r"/\.claude/worktrees/.*", "", turn["project"])).name
        did = f" {label['did']}" if label.get("did") else ""
        out.append(f"- {label['family']} — `{turn['session'][:8]}`, {project}: \"{squeeze(label['quote'])}\".{did}")
    return "\n".join(out) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Builds a corrections report from turns and labels.")
    parser.add_argument("turns", type=Path)
    parser.add_argument("labels", type=Path)
    parser.add_argument("--mistakes", type=Path, default=MISTAKES)
    args = parser.parse_args()
    codes = families(args.mistakes)
    if not codes:
        sys.exit(f"{args.mistakes} has no family rows, rows that start like | `BEH.REP` |.")
    codes.append("other")
    turns = {turn["id"]: turn for turn in lines(args.turns)}
    labels = lines(args.labels)
    found = problems(labels, turns, codes)
    if found:
        sys.exit("\n".join(found))
    print(report(labels, turns, codes), end="")


if __name__ == "__main__":
    main()
