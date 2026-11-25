# Working on kulmine

## Loading the plugin from a clone

In the root of the clone:

```bash
ln -s "$PWD" ~/.claude/skills/kulmine
```

A change reaches the next session, or the current one after `/reload-plugins`. Keep either this link or the marketplace install, not both: the marketplace takes precedence over the checkout.

For the `kulmine` command in the terminal, link the clone's `bin/kulmine` into your `PATH`.

## Tests

In the root (each hook has its tests in its own folder):

```bash
python3 -I -m unittest discover -s hooks/docs
```

```bash
python3 -I -m unittest discover -s hooks/chat
```

```bash
python3 -I -m unittest discover -s hooks/issue
```

```bash
python3 -I -m unittest discover -s hooks/vendor
```

In `skills/analyzing-sessions/scripts`, `skills/domain-modeling/scripts` and `skills/pages/scripts`:

```bash
python3 -I -m unittest discover -p 'test_*.py'
```

In `skills/building-ui/scripts` (Node ≥ 20; the reload tests watch files and open a local port, which the sandbox blocks):

```bash
node --test
```

The glossary tests open a port on `127.0.0.1`, which the Claude Code sandbox blocks unless `sandbox.network.allowLocalBinding` is true.

## Projects that vendor kulmine

Claude Code cloud sessions don't load plugins, so a project that uses kulmine keeps a copy of it as a git subtree in `vendor/kulmine`:

```bash
git subtree add --prefix vendor/kulmine /path/to/kulmine main --squash
```

That copy goes stale with every commit on `main` here. To have it updated automatically, in the kulmine clone:

```bash
git config core.hooksPath githooks
```

```bash
git config --add kulmine.consumer /path/to/project
```

From then on every commit, merge or rebase on `main` updates the `vendor/kulmine` of every registered project (`hooks/vendor/vendor.py`, run by the hooks in `githooks/`). If a project has uncommitted changes or is not on `main`, the script leaves it alone and prints the command to run.

The script configures the rest of the project: after each update it rewrites kulmine's hooks into the project's `.claude/settings.json` from the vendored copy's `hooks/hooks.json` (guarded by `CLAUDE_CODE_REMOTE`, because locally the plugin takes care of it) and relinks its output style. The project's own hooks stay where they are, so a new hook here no longer needs registering by hand there.

The only entry to write by hand, once, is the `SessionStart` hook that runs the script: it is the net for updates that arrived while the project was dirty or on another branch.

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "python3 -I \"$CLAUDE_PROJECT_DIR/vendor/kulmine/hooks/vendor/vendor.py\"",
            "timeout": 60
          }
        ]
      }
    ]
  }
}
```

On the project side the script finds the kulmine clone through `$KULMINE_SOURCE`, `git config kulmine.source`, or the `~/.claude/skills/kulmine` link above; in cloud sessions, where there is no clone, it does nothing.
