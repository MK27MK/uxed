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

The glossary tests open a port on `127.0.0.1`, which the Claude Code sandbox blocks unless `sandbox.network.allowLocalBinding` is true.

## Projects that vendor kulmine

How a project sets it up is in the README, under Cloud sessions. The project's `kulmine` workflow runs `hooks/vendor/vendor.py`, which pulls kulmine's `main` from GitHub into `vendor/kulmine` with `git subtree pull --squash`, rewrites kulmine's hooks into the project's `.claude/settings.json` from the vendored `hooks/hooks.json` (guarded by `CLAUDE_CODE_REMOTE`), relinks the output style and commits; the workflow pushes to `main`. The project's own hooks stay where they are.

The workflow runs daily. To run it right after every push to kulmine's `main`, `.github/workflows/consumers.yml` starts it in each repository listed in kulmine's Actions secret `KULMINE_CONSUMERS` (`owner/repo` names separated by spaces), using the secret `KULMINE_DISPATCH_TOKEN`: a fine-grained token with Actions read and write on those repositories. The names are a secret, not a variable, because kulmine's Actions logs are public and secrets are masked there.

The consumer workflow file can't update itself, because the workflow's token may not push to `.github/workflows/`: keep its logic in `vendor.py`, which does travel with the subtree.
