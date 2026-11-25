#!/usr/bin/env python3
"""Prepare a kulmine page: create the file in its place and copy the shared component into it.

    pages.py path <type> <name> [--root DIR]   print .kulmine/pages/<type>/<name>.html and create the folder
    pages.py config [--root DIR]               print the project configuration (.kulmine/config.json) as JSON,
                                               with defaults: {"language": {"tracker": "en", "work": "en",
                                               "chat": "adaptive"}, "tracker": null}
    pages.py inline <file>                     put the component in place of <!-- kulmine:component -->,
                                               or update the one already there

The component lives in `component.html`, next to this folder. The page stays a single self-contained file,
so the agent never rewrites the component by hand.
"""

import argparse
import json
import re
import sys
from pathlib import Path

COMPONENT = Path(__file__).resolve().parents[1] / "component.html"
PLACEHOLDER = "<!-- kulmine:component -->"
BLOCK = re.compile(r"<!-- kulmine:component:start -->.*?<!-- kulmine:component:end -->", re.S)
SLUG = re.compile(r"[^a-z0-9]+")
LANGUAGES = {"tracker": "en", "work": "en", "chat": "adaptive"}
DEFAULTS = {"language": LANGUAGES, "tracker": None}


def slug(text: str) -> str:
    return SLUG.sub("-", text.lower()).strip("-") or "page"


def config(root: Path) -> dict:
    """The project configuration: `.kulmine/config.json` over the defaults. A broken file is an error, not a default."""
    file = root / ".kulmine" / "config.json"
    data = json.loads(file.read_text(encoding="utf-8")) if file.is_file() else {}
    if not isinstance(data, dict):
        raise ValueError(f"{file} must contain a JSON object")
    tracker = data.get("tracker")
    if tracker is not None and not (isinstance(tracker, dict) and tracker.get("kind") and tracker.get("team")):
        raise ValueError(f'{file}: "tracker" needs at least "kind" and "team", for example {{"kind": "linear", "team": "ENG"}}')
    return {**DEFAULTS, **data, "language": languages(data.get("language"), file)}


def languages(value, file: Path) -> dict:
    """The three languages over their defaults. A bare string is the old single setting: issues and work, not chat."""
    if value is None:
        value = {}
    elif isinstance(value, str):
        value = {"tracker": value, "work": value}
    if not isinstance(value, dict) or set(value) - set(LANGUAGES) or not all(isinstance(v, str) and v for v in value.values()):
        raise ValueError(f'{file}: "language" takes {", ".join(LANGUAGES)} as language codes, for example '
                         f'{{"tracker": "en", "work": "en", "chat": "adaptive"}}')
    return {**LANGUAGES, **value}


def page_path(root: Path, kind: str, name: str) -> Path:
    pages = root / ".kulmine" / "pages"
    path = pages / slug(kind) / f"{slug(name)}.html"
    path.parent.mkdir(parents=True, exist_ok=True)
    if config(root)["tracker"]:
        # With a tracker the page lives in the issue: this is only the working copy, kept out of git.
        (pages / ".gitignore").write_text("*\n", encoding="utf-8")
    return path


def inline(html: str, component: str) -> str:
    """The page text with the component in place of the placeholder or of the existing block."""
    component = component.strip()
    if BLOCK.search(html):
        return BLOCK.sub(lambda _: component, html, count=1)
    if PLACEHOLDER in html:
        return html.replace(PLACEHOLDER, component, 1)
    raise ValueError(f"the page is missing {PLACEHOLDER}: put it where the component goes, before the page's scripts")


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="pages.py")
    sub = parser.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("path")
    p.add_argument("kind")
    p.add_argument("name")
    p.add_argument("--root", default=".")
    c = sub.add_parser("config")
    c.add_argument("--root", default=".")
    i = sub.add_parser("inline")
    i.add_argument("file")
    args = parser.parse_args(argv)

    try:
        if args.cmd == "path":
            print(page_path(Path(args.root), args.kind, args.name))
            return 0
        if args.cmd == "config":
            print(json.dumps(config(Path(args.root)), ensure_ascii=False))
            return 0
    except (OSError, ValueError) as e:
        print(f"pages.py: {e}", file=sys.stderr)
        return 1
    file = Path(args.file)
    try:
        file.write_text(inline(file.read_text(encoding="utf-8"), COMPONENT.read_text(encoding="utf-8")), encoding="utf-8")
    except (OSError, ValueError) as e:
        print(f"pages.py: {e}", file=sys.stderr)
        return 1
    print(file)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
