#!/usr/bin/env python3
"""Bring a project's vendored copy of kulmine up to date with kulmine's `main` on GitHub.

Claude Code cloud sessions do not load plugins, so projects that use kulmine keep
a copy of it as a git subtree in `vendor/kulmine`. The project's GitHub Actions
workflow (`consumer-workflow.yml`, installed as `.github/workflows/kulmine.yml`)
runs this script on `main` and pushes the result, so the copy follows every merge
on GitHub without depending on anyone's clone:

1. pulls kulmine's `main` into `vendor/kulmine` (`git subtree pull --squash`) if
   the copy is behind;
2. rewrites kulmine's hooks into the project's `.claude/settings.json` from the
   vendored `hooks/hooks.json`, so a new hook needs no registering by hand, and
   relinks the output style; commits that too.

    vendor.py [--source URL] [--root DIR]
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

PREFIX = "vendor/kulmine"
BRANCH = "main"
SOURCE = "https://github.com/MK27MK/kulmine.git"
SETTINGS = ".claude/settings.json"
STYLE = ".claude/output-styles/kulmine.md"
# kulmine's hooks are needed only where the plugin is missing: cloud sessions.
CLOUD_ONLY = '[ "$CLAUDE_CODE_REMOTE" != true ] || '
def git(repo: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(repo), *args],
        capture_output=True,
        text=True,
        check=False,
    )


def out(repo: Path, *args: str) -> str | None:
    """The stdout of a successful git command, None if the command failed."""
    result = git(repo, *args)
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def toplevel(start: Path) -> Path | None:
    path = out(start, "rev-parse", "--show-toplevel")
    return Path(path) if path else None


def head_commit(consumer: Path, source: str) -> str | None:
    """The commit of kulmine's `main` at `source`, a URL or a path."""
    listed = out(consumer, "ls-remote", source, f"refs/heads/{BRANCH}")
    return listed.split()[0] if listed else None


def vendored_commit(consumer: Path) -> str | None:
    """The kulmine commit the project's `vendor/kulmine` comes from."""
    message = out(
        consumer,
        "log",
        "-1",
        f"--grep=^git-subtree-dir: {PREFIX}/*$",
        "--format=%B",
    )
    if not message:
        return None
    for line in reversed(message.splitlines()):
        if line.startswith("git-subtree-split:"):
            return line.split(":", 1)[1].strip()
    return None


def has_vendor(consumer: Path) -> bool:
    return out(consumer, "rev-parse", f"HEAD:{PREFIX}") is not None


def is_clean(consumer: Path) -> bool:
    return git(consumer, "diff-index", "--quiet", "HEAD", "--").returncode == 0


def pull(source: str, consumer: Path) -> str | None:
    """Update `vendor/kulmine` in `consumer`. None if it was already current."""
    head = head_commit(consumer, source)
    if head is None:
        raise RuntimeError(f"cannot read {BRANCH} of {source}")
    if vendored_commit(consumer) == head:
        return None
    if not is_clean(consumer):
        raise RuntimeError(f"{consumer.name} has uncommitted changes")
    short = head[:7]
    result = git(consumer, "subtree", "pull", "--prefix", PREFIX, source, BRANCH, "--squash",
                 "-m", f"Update vendor/kulmine to {short}")
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip().splitlines()
        raise RuntimeError(detail[-1] if detail else "git subtree pull failed")
    return f"{PREFIX} updated to kulmine {short}."


def update(consumer: Path, source: str = SOURCE) -> str | None:
    """Pull kulmine and commit the hooks it registers. None if nothing was needed."""
    if not has_vendor(consumer):
        return None
    pulled = pull(source, consumer)
    registered = register(consumer)
    if registered:
        git(consumer, "add", "--", SETTINGS, STYLE)
        result = git(consumer, "commit", "-m", "Register kulmine's hooks", "--", SETTINGS, STYLE)
        if result.returncode != 0:
            raise RuntimeError((result.stderr or result.stdout).strip() or "git commit failed")
    done = [message for message in (pulled, registered) if message]
    return " ".join(done) if done else None


def is_kulmine(entry: dict) -> bool:
    """Whether the project's `hooks` entry is one generated from here."""
    return any(PREFIX in hook.get("command", "") for hook in entry.get("hooks", []))


def kulmine_hooks(consumer: Path) -> dict[str, list[dict]] | None:
    """The vendored plugin's hooks, rewritten for the project's `settings.json`."""
    manifest = consumer / PREFIX / "hooks" / "hooks.json"
    if not manifest.is_file():
        return None
    spec = json.loads(manifest.read_text())["hooks"]
    events: dict[str, list[dict]] = {}
    for event, entries in spec.items():
        events.setdefault(event, [])
        for entry in entries:
            rewritten = {key: value for key, value in entry.items() if key != "hooks"}
            rewritten["hooks"] = [
                {
                    **hook,
                    "command": CLOUD_ONLY
                    + hook["command"].replace(
                        "${CLAUDE_PLUGIN_ROOT}", f"$CLAUDE_PROJECT_DIR/{PREFIX}"
                    ),
                }
                for hook in entry["hooks"]
            ]
            events[event].append(rewritten)
    return events


def register(consumer: Path) -> str | None:
    """Bring kulmine's hooks in the project's `settings.json` and the style link up to date."""
    generated = kulmine_hooks(consumer)
    if generated is None:
        return None
    changed = []
    path = consumer / SETTINGS
    settings = json.loads(path.read_text()) if path.exists() else {}
    before = json.dumps(settings, sort_keys=True)
    hooks = settings.setdefault("hooks", {})
    for event in list(hooks):
        own = [entry for entry in hooks[event] if not is_kulmine(entry)]
        if own or event in generated:
            hooks[event] = own
        else:
            del hooks[event]
    for event, entries in generated.items():
        hooks[event] = hooks.get(event, []) + entries
    if not hooks:
        settings.pop("hooks", None)
    if json.dumps(settings, sort_keys=True) != before:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(settings, indent=2, ensure_ascii=False) + "\n")
        changed.append(SETTINGS)

    style = consumer / STYLE
    target = Path("../../") / PREFIX / "output-styles" / "kulmine.md"
    if not style.is_symlink() or Path(os.readlink(style)) != target:
        style.parent.mkdir(parents=True, exist_ok=True)
        if style.is_symlink() or style.exists():
            style.unlink()
        style.symlink_to(target)
        changed.append(STYLE)

    if not changed:
        return None
    return f"{' and '.join(changed)} brought in line with kulmine's hooks."


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="vendor.py")
    parser.add_argument("--source", default=SOURCE)
    parser.add_argument("--root", default=".")
    args = parser.parse_args(argv)
    consumer = toplevel(Path(args.root))
    if consumer is None:
        print(f"kulmine vendor: {args.root} is not a git repository", file=sys.stderr)
        return 1
    try:
        message = update(consumer, args.source)
    except RuntimeError as error:
        print(f"kulmine vendor: {error}", file=sys.stderr)
        return 1
    print(f"kulmine vendor: {message or 'already current'}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
