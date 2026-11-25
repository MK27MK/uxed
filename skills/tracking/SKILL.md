---
name: tracking
description: Keeps the project's work in its issue tracker (Linear), with kulmine pages inside the issues. Use it before editing the code of a project with a tracker, even if the session is open in another project, when you open, search, pick, start or close a piece of work, when a work page (spec, plan, prototype, research, review) must end up in an issue, when the user asks what to do next, and to re-read an issue's page.
---

# Tracking

`python3 "${CLAUDE_SKILL_DIR}/../pages/scripts/pages.py" config` prints the project's config (`.kulmine/config.json`). If `tracker` is `null` this skill does nothing: pages stay in `.kulmine/pages/` and go into git. Otherwise the tracker is `tracker.kind` (currently only `linear`, with its MCP tools) and the team is `tracker.team`. If the session's Linear tools look at another workspace, connecting the project's one is in `linear-configuration.md`.

Canceled and Duplicate issues don't exist for you: every `list_issues` filters by state (Backlog, Todo, In Progress, In Review, and Done only when you look for work already done), and you don't open a closed issue even when a link or a relation leads there. They are discarded work and would muddy your context.

Every piece of work in a project with a tracker starts from its issue: feature, fix, refactor, spec, plan, research or prototype, the issue is found or opened as the first move, before exploring the code, planning or writing a page, even when the work comes up in the middle of other work or in a session opened in another project (what counts is the `.kulmine/config.json` of the project you will touch). The `hooks/issue/issue.py` hook reminds you on every user message and, as a net, denies edits until the session has read or created an issue of that team or is on the branch of one of its issues. New work inside the same session opens a new issue; it doesn't get tacked onto the old one.

## Titles

An issue's title, its page's `<title>` and its PR's title say the same sentence, each in its own language (`language.tracker`, `language.chat`, `language.work` in the config):

- imperative, verb first;
- capitalized only at the start and in proper nouns, without prefixes, brackets, IDs or a trailing period, at most 60 characters;
- states the result, not the activity: `Merge the design docs into the design page`, not `Design docs`, `[UI] design cleanup` or `Investigate design docs`.

Issue title, description and comments are in `language.tracker`; the page follows the chat.

## Opening an issue

1. Search with `list_issues` (`query`, team) for an issue that already covers the same work: if there is one, use it.
2. Create it with `save_issue`: team, title, a project (`list_projects`), exactly one type label, priority if the user gave one. Description: two or three sentences on the expected result; the rest is in the page.

## Labels

A label says only what no Linear field already says, that is the type of result. State, priority, project, assignee, blockers and sub-issues have their own fields: a label that repeats them becomes a second truth that drifts from the first.

| Label | The issue produces |
|---|---|
| Bug | A fix: something was broken. |
| Feature | Something that wasn't there. |
| Improvement | Something that was there, made better. |
| RFC | A decision written in `docs/decisions/`, without code; it closes when the record exists. |

If a team lacks one, create it with `save_issue_label` using the table row as its description. Don't use or create other labels.

## Pages in issues

Work pages have an issue: `interview-me` specs, plans, prototypes, research, reviews. Teaching pages and throwaway reports stay Artifacts only.

1. The file is a working copy in `.kulmine/pages/`, outside git: `pages.py path` creates it as usual.
2. After every publish upload it to the issue's Resources (`prepare_attachment_upload`, PUT with `curl --data-binary`, `create_attachment_from_upload`) with the issue's title, and remove the previous version with `delete_attachment`. On the first publish also add the link to the Artifact (`save_issue` with `links`).
3. A session that picks the issue back up downloads the file from `get_issue` → `get_attachment` into the same folder, edits it and republishes to the same Artifact (its URL is in the `<meta name="kulmine:artifact">`).

## Lifecycle

- **Pick**: if the user asks what to do, take the team's Todo and then Backlog issues in priority order (1 urgent … 4 low, 0 none last), the oldest first on a tie.
- **Start**: move the issue to In Progress and work on the branch of its `gitBranchName`.
- **Close**: the PR has the issue's title, `Fixes <ID>` and a description of the diff (what changes, how to verify it), never a copy of the issue. Linear's GitHub integration moves it to In Review and Done; if after the PR is opened the issue doesn't show it among its attachments, the integration is missing and you move it yourself, to In Review when it opens (if the team has no such state it stays In Progress) and to Done on merge.

## Linear and GitHub

Linear holds the work (issues, type, priority, pages), GitHub the code (diffs, reviews, CI). Don't open issues or put labels on GitHub. A GitHub issue found in a project with a tracker is moved into a Linear issue, if it is still to do, and closed with a line pointing to it.
