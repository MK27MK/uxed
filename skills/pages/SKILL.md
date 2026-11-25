---
name: pages
description: Builds and publishes a kulmine HTML page, the format in which the agent answers the user for everything that doesn't fit in one sentence. Use it for every page (plans, specs, explanations, comparisons, reviews, research, reports, questions) and when a page must collect the user's choices and bring them back to the agent.
---

# Pages

Every page is a project file, published as an Artifact: the file is the context you hand to whoever works next (a new session, a subagent, a reviewer), the Artifact is what the user opens, even from their phone.

1. **Place.** `python3 "${CLAUDE_SKILL_DIR}/scripts/pages.py" path <type> <name>` prints `.kulmine/pages/<type>/<name>.html` and creates its folder. Types: `interview`, `teaching`, `prototype`, `research`, `plan`, `review`, `report`. With a tracker in the config (`pages.py config`) the folder is outside git and the page lives in its issue: follow `kulmine:tracking`; without one, the folder goes into git. Write the page in the chat's language (`language.chat`; `adaptive` is the user's last message).
2. **Write.** Follow the Artifact tool's page contract. Design the page around its subject and define the tokens `--bg --surface --ink --muted --line --accent` (for the dark theme too): the shared components use them.
3. **Collect the choices.** If the page asks the user something, put `<!-- kulmine:component -->` before your scripts and run `python3 "${CLAUDE_SKILL_DIR}/scripts/pages.py" inline <file>`, which copies `component.html` into it; run it again after every change to the component. Then use:
   - `kulmine.interview(el, {areas, questions})`: one question at a time, with a summary. `areas`: `{key: {label, color}}`. Each question: `{id, area, short, topic, q, why, multi, opts: [{t, d, rec}]}`.
   - `data-k-id`, `data-k-label`, `data-k-options="keep,drop"` on an element: option buttons to choose from.
   - `kulmine.put(id, label, value, note)`: an entry of the reply from a control of yours; send only what changed.
   - `<div data-k-reply data-k-title="…">` at the bottom, always: it composes the reply, saves it for you and lets the user copy it.
4. **Publish.** Artifact tool with the project file as `file_path` and, if the component is there, `capabilities: {db: {}}`. After the first publish write `<meta name="kulmine:artifact" content="<url>">` next to the `<title>`: a later session reads the URL from there, re-reads the Artifact and republishes to the same link.
5. **Read the reply.** When the user writes "done", read the Artifact's `replies/latest` document with `ArtifactData`; if it's missing, ask them to paste the copied reply.

A later round on the same question updates the same page: same file, same link.
