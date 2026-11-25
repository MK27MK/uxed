#!/usr/bin/env python3
"""Keep the vendored copy of kulmine up to date in the projects that use it.

Claude Code cloud sessions do not load plugins, so projects that use kulmine keep
a copy of it as a git subtree in `vendor/kulmine`. That copy goes stale with every
commit on `main` here: this script brings it up to date by itself.

Two sides, same job:

- source side, from kulmine's git hooks (`--source-side`): after a commit, merge
  or rebase on `main`, updates the subtree of every project registered with
  `git config --add kulmine.consumer <path>`;
- project side, from the project's SessionStart hook (no arguments): at session
  start updates its `vendor/kulmine` if it is behind, as a net for commits that
  arrived while the project was dirty or on another branch.

After the update it rewrites kulmine's hooks into the project's
`.claude/settings.json` from the vendored copy's `hooks/hooks.json`, so a new hook
does not need registering by hand, and relinks its output style.

When it cannot update (dirty worktree, branch other than `main`) it touches
nothing and says so: the message ends up in the session's context.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

PREFIX = "vendor/kulmine"
BRANCH = "main"
SETTINGS = ".claude/settings.json"
STYLE = ".claude/output-styles/kulmine.md"
# kulmine's hooks are needed only where the plugin is missing: cloud sessions.
CLOUD_ONLY = '[ "$CLAUDE_CODE_REMOTE" != true ] || '
SYNC_HOOK = {
    "matcher": "startup|resume",
    "hooks": [
        {
            "type": "command",
            "command": f'python3 -I "$CLAUDE_PROJECT_DIR/{PREFIX}/hooks/vendor/vendor.py"',
            "timeout": 60,
        }
    ],
}


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


def head_commit(source: Path) -> str | None:
    return out(source, "rev-parse", f"refs/heads/{BRANCH}")


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


def current_branch(consumer: Path) -> str | None:
    return out(consumer, "rev-parse", "--abbrev-ref", "HEAD")


def pull(source: Path, consumer: Path) -> str | None:
    """Update `vendor/kulmine` in `consumer`. None if it was already current."""
    head = head_commit(source)
    if head is None or vendored_commit(consumer) == head:
        return None

    name = consumer.name
    short = head[:7]
    command = f"cd {consumer} && git subtree pull --prefix {PREFIX} {source} {BRANCH} --squash"
    branch = current_branch(consumer)
    if branch != BRANCH:
        return f"{name}: {PREFIX} is behind (kulmine {short}) but the project is on branch {branch}; update it on {BRANCH} with `{command}`."
    if not is_clean(consumer):
        return f"{name}: {PREFIX} is behind (kulmine {short}) but the worktree has uncommitted changes; once it is clean, update it with `{command}`."

    result = git(
        consumer,
        "subtree",
        "pull",
        "--prefix",
        PREFIX,
        str(source),
        BRANCH,
        "--squash",
        "-m",
        f"Update vendor/kulmine to {short}",
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip().splitlines()
        tail = detail[-1] if detail else "git subtree pull failed"
        return f"{name}: updating {PREFIX} failed ({tail}); fix it with `{command}`."
    return f"{name}: {PREFIX} updated to kulmine {short}."


def sync(source: Path, consumer: Path) -> str | None:
    """Update the vendored copy and its registration. None if nothing was needed."""
    if not has_vendor(consumer):
        return None
    messages = [pull(source, consumer), register(consumer)]
    done = [message for message in messages if message]
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
    events: dict[str, list[dict]] = {"SessionStart": [dict(SYNC_HOOK)]}
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
    return f"{consumer.name}: {' and '.join(changed)} brought in line with kulmine's hooks."


def consumers(source: Path) -> list[Path]:
    listed = out(source, "config", "--get-all", "kulmine.consumer") or ""
    return [Path(line).expanduser() for line in listed.splitlines() if line.strip()]


def find_source(consumer: Path) -> Path | None:
    """The kulmine clone to update from, if there is one on this machine."""
    candidates = [
        os.environ.get("KULMINE_SOURCE"),
        out(consumer, "config", "--get", "kulmine.source"),
        "~/.claude/skills/kulmine",
    ]
    for candidate in candidates:
        if not candidate:
            continue
        path = Path(candidate).expanduser()
        if not path.is_dir():
            continue
        root = toplevel(path.resolve())
        if root is not None and root != consumer and head_commit(root):
            return root
    return None


def source_side() -> list[str]:
    source = toplevel(Path.cwd())
    if source is None or current_branch(source) != BRANCH:
        return []
    return [message for path in consumers(source) if (message := sync(source, path))]


def consumer_side() -> list[str]:
    start = os.environ.get("CLAUDE_PROJECT_DIR") or str(Path.cwd())
    consumer = toplevel(Path(start))
    if consumer is None:
        return []
    source = find_source(consumer)
    if source is None:
        return []
    message = sync(source, consumer)
    return [message] if message else []


def main(argv: list[str]) -> int:
    for message in source_side() if "--source-side" in argv else consumer_side():
        print(f"kulmine vendor: {message}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
