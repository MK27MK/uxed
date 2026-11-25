# kulmine

kulmine is a Claude Code plugin: it corrects the agent's habits (agreeing with you, adding things nobody asked for, declaring its own work good) and makes it answer with HTML pages instead of walls of text.

How to load the plugin from a clone and how to run the tests is in `CONTRIBUTING.md`.

## Changing the harness

This applies to every change to the harness — skills, subagents, hooks, settings, permissions, memory, rules, `CLAUDE.md`, `AGENTS.md`, output styles — here or in another project, even a one-liner.

1. **Start from a correction.** A piece is added only for a correction the user actually made or for work that repeated itself, never for a hypothetical improvement. In a session opened to improve kulmine, the corrections are in the latest report of `kulmine:analyzing-sessions`, in the user's comments on the session pages, and in the user's commits compared with the agent text they replaced. Give each one a code from [docs/common-ai-errors.md](docs/common-ai-errors.md) or `other`; `other` corrections that share a default become a new family if the user agrees.
2. **Pick the level.** The highest one whose mechanism can decide when the behavior kicks in: type, test, lint, hook, path rule (`.claude/rules/` with `paths:`), skill, `CLAUDE.md` or output style, memory. Code decides what it can compute; the meaning of a sentence goes to a model, with code at most on the computable part. State the level and why the one above can't hold it, and apply it only to the projects where the situation occurs.
3. **Build** with the tool for the type: a skill with `anthropic-skills:skill-creator`; a hook that kulmine ships in `hooks/hooks.json`, checking every field with `claude-code-guide`; a mod with `plugin-authoring`; a user or project setting, permission or hook with `update-config`.
4. **Judge** with code or with the user, never with a model: it shares the default it should be judging. `claude plugin eval` runs each case with the plugin and without; the deterministic graders count, while the `llm` grader and skill-creator's evals are only hints. Length, tone and taste are judged by the user. Start a paid run only if the user accepts its cost.
5. **Retire** a piece that makes no difference against the baseline, or that fired without effect in its real uses, until a search for its name in the checkout finds nothing; git keeps it.

### Delegation

Change the harness of the project you are working on by yourself: it is reversible and stays there. **Propose before committing to kulmine**: what ships from here reaches every project that installs it and every vendored copy, and a wrong hook blocks their sessions, not yours.

### Rules

- Edit the git checkout (where `~/.claude/skills/kulmine` points, or the clone the user names), never the installed copy: it is a cache the next update overwrites.
- A subagent only if it differs from the main agent in information, tools, memory or judge, because it costs a whole run on every use.
- A domain skill goes in the project where that work happens (`.claude/skills/`), filled with what the domain's primary sources show the model gets wrong (`kulmine:researching`).
- Write a rule only for an observed error, for its class and not for the single case, with the reason in a few words and examples from a generic domain, never from the project.
- A skill is short and imperative: only what the model and the built-ins don't do on their own, in the present state, with no history or test results.
- Don't repeat: if the prompt, the style or another instruction already says something, saying it again elsewhere creates two copies that diverge at the first change.
- During a skill-creator eval on a kulmine skill, disable kulmine for that run in `enabledPlugins` of `.claude/settings.local.json` (`"kulmine@kulmine": false`, or the key `/plugin` shows) and restore it afterwards: the installed copy competes with the one under test.
- Keep secrets and private customer data out of what gets committed or loaded into later sessions.

### Before committing

`claude plugin validate .` with no errors or warnings, except the missing `version` (omitted on purpose, so every commit on main reaches auto-update) and the missing icon; every description at most 1,024 characters, with no `<` or `>`. The commit message names the code it fixes, like `BEH.REP`, so `git log --grep` lists the remedies of a family.
