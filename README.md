# kulmine

A Claude Code plugin that corrects the agent's habits (agreeing with you, adding things nobody asked for, declaring its own work good) and makes it answer with HTML pages instead of walls of text.

It follows the method of Thariq ([@trq212](https://x.com/trq212)), from the Claude Code team: *thin prompts, thick artifacts + context, thin skills*.

- [Using Claude Code: the unreasonable effectiveness of HTML](https://claude.dev/blog/using-claude-code-the-unreasonable-effectiveness-of-html/)
- [The examples](https://thariqs.github.io/html-effectiveness/)
- [Know your unknowns](https://thariqs.github.io/html-effectiveness/unknowns/index.html)

## What it does

- **Style**: one sentence in chat. Everything else is a page published as an Artifact, which lives in its issue tracker issue or, without a tracker, in `.kulmine/pages/`: you choose on it with cards and option buttons, and your choices go back to the agent.
- **Hooks**: send back a chat message longer than one sentence, block edits to Claude Code configuration until the session has read the docs, and, in a project with a tracker, make every piece of work start from its issue.
- **Skills**: `interview-me` (questions that become a spec), `teaching` (what you don't know you don't know), `prototyping` (options to see and pick), `researching`, `tracking` (Linear issues with imperative titles), `domain-modeling` (the `GLOSSARY.md`), `orchestrate` and `analyzing-sessions`.

## Installation

You need Claude Code, `git` and `python3` ≥ 3.9.

```bash
claude plugin marketplace add MK27MK/kulmine
```

```bash
claude plugin install kulmine@kulmine
```

For a single project add `--scope local` to both. It activates at the next session or after `/reload-plugins`; update it with `claude plugin update kulmine@kulmine`.

The skills alone, for any agent, with [skills](https://github.com/vercel-labs/skills): `npx skills add MK27MK/kulmine`. The style and the hooks need Claude Code.

To work on it: [CONTRIBUTING.md](CONTRIBUTING.md).

## Configuration

`.kulmine/config.json` in the project, all optional:

```json
{"language": {"tracker": "en", "work": "en", "chat": "adaptive"}, "tracker": {"kind": "linear", "team": "ENG"}}
```

`language` has three parts: `tracker` for issues (default English), `work` for what gets committed, code, docs, commits and PRs (default English), `chat` for the chat, pages and Artifacts (default `adaptive`, the language of the user's last message). Each takes a language code; the old single string still works and sets `tracker` and `work`. With `tracker`, work pages live in the issues; without it, they stay in `.kulmine/pages/`.

Set `KULMINE_STYLE=off` in the environment to silence the style hooks.

## Cloud sessions

Claude Code sessions in the cloud don't load plugins, so without this they run without kulmine. A project that wants kulmine there keeps a copy of it in `vendor/kulmine`, and a GitHub Actions workflow keeps that copy current and registers its hooks and style in the project's `.claude/settings.json`, active only in cloud sessions (locally the plugin does the job).

```bash
git subtree add --prefix vendor/kulmine https://github.com/MK27MK/kulmine.git main --squash
```

```bash
mkdir -p .github/workflows && cp vendor/kulmine/hooks/vendor/consumer-workflow.yml .github/workflows/kulmine.yml
```

Commit and push to `main`, then run the `kulmine` workflow once from the Actions tab. From then on it updates `vendor/kulmine` every day and pushes the commit to `main`; nothing to do by hand.
