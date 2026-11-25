---
name: researching
description: Investigate a question against high-trust primary sources and capture the findings as an HTML page in the repo. Use when the user wants a topic researched, docs or API facts gathered, or reading legwork delegated to a background agent.
---

Use a **background agent** to do the research, so you keep working while it reads. Start it with a fresh context window.

Its job:

1. Investigate the question against **primary sources** (official docs, source code, specs, first-party APIs), not a secondary write-up of them. Follow every claim back to its source.
2. Write the findings as a page following `${CLAUDE_PLUGIN_ROOT}/skills/pages/SKILL.md`, at the path its `path` command gives for type `research`: the answer first, then each claim with its source linked.

When it finishes, publish the page and give the user the link. With a tracker in the project config, attach the page to its issue with `kulmine:tracking`.
