# kulmine

<p align="center">
  <img src="docs/images/wanderer-above-the-sea-of-fog.jpg" alt="Wanderer above the Sea of Fog by Caspar David Friedrich: a man in a dark coat stands on a rocky summit, his back to the viewer, looking out over a sea of fog" width="420">
  <br>
  <sub><i>Wanderer above the Sea of Fog</i>, Caspar David Friedrich, c. 1818.</sub>
</p>

<blockquote>
  <dl>
    <dt><b>culmine</b> &nbsp;/ˈkul.mi.ne/&nbsp; <code>KOOL-mee-neh</code> &nbsp;<i>noun, masculine (Italian)</i></dt>
    <dd>1. The highest point of something physical; the summit, peak or top of a mountain or building.</dd>
    <dd>2. <i>Figurative.</i> The height or climax of something: the point of greatest intensity, success or perfection.</dd>
    <dd><sub>From Latin <i>culmen, culminis</i>, “top, summit, roof-ridge”; related to English <i>culminate</i>.</sub></dd>
  </dl>
</blockquote>

kulmine puts you on the summit: you hold the vision, Claude Code does the climbing.

It gets you there through the method of Thariq ([@trq212](https://x.com/trq212)), from the Claude Code team: *thin prompts, thick artifacts + context, thin skills*. The agent answers in one sentence and puts everything else on an interactive HTML page. It also drops the habits that drag you back down into the details: agreeing with you, asking you useless stuff, grading its own work.

- [Using Claude Code: the unreasonable effectiveness of HTML](https://claude.dev/blog/using-claude-code-the-unreasonable-effectiveness-of-html/)
- [The examples](https://thariqs.github.io/html-effectiveness/)

## Paradigm shift: your first climb

One person can now do the work of a dozen roles without having trained for any of them. The danger is doing it blind. Say you need a pricing page and have never touched marketing, design or billing.

You describe what you want, and `teaching` answers the way a pricing consultant would. It gives you the words you were missing, *anchoring*, *decoy tier*, *proration*, so your next prompt sounds like you've done this before. The idea comes from Felix Rieseberg's [How to be more ambitious](https://felixrieseberg.com/how-to-be-more-ambitious-a-tutorial-for-humans-with-models/).

The agent's questions arrive as a page from `interview-me`, and your answers become the spec. Three ways to lay out the tiers? `prototyping` draws all three and you click the one you want.

While it builds, the chat stays quiet: one sentence with the result and a link to a page with the rest, filed in its Linear issue by `tracking` (or in `.kulmine/pages/` if you don't use a tracker). Hooks hold it to that. A reply longer than one sentence goes back to be rewritten, and the session can't edit the Claude Code configuration before reading the docs or start work that has no issue.

For the rest of the climb there's `researching` (primary sources), `domain-modeling` (a `GLOSSARY.md` with its own interactive page), `wait-what` (for a reply that didn't land), `orchestrate` (jobs too big for one agent) and `analyzing-sessions` (the places where you had to correct the agent). The first three are adapted from Matt Pocock's [skills](https://github.com/mattpocock/skills).

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

Want to push it further? [CONTRIBUTING.md](CONTRIBUTING.md).

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

Commit and push to `main`, then run the `kulmine` workflow once from the Actions tab. From then on it updates `vendor/kulmine` every day and pushes the commit to `main` on its own.
