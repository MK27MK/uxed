---
name: analyzing-sessions
description: Reads past Claude Code sessions looking for the user's corrections, in two modes. Count - labels every correction since the last report with an error type from common-ai-errors.md or other, has the user confirm the labels on a page and writes the counts to ~/.kulmine/corrections/. Session page - turns a finished session into a page the user comments on message by message, then acts on every comment. Use it when the user asks to count their corrections, which errors keep coming back or whether a change to the agent setup made them rarer, and when they want to review, comment on or walk through a finished session.
disable-model-invocation: true
---

# Analyzing sessions

A **correction** is a user turn saying the previous reply or action was wrong, unwanted, too long, incomplete or off topic, that repeats an instruction already given, or that interrupts the agent. New requests, approvals, answers and follow-up questions are not.

## Count

The error types are the rows of the table in `${CLAUDE_SKILL_DIR}/../../docs/common-ai-errors.md`. During the Count don't touch that file or the agent setup: you are measuring them.

1. **Turns.** `python3 "${CLAUDE_SKILL_DIR}/scripts/turns.py" > <scratchpad>/turns.jsonl`, with `--since <date>` only if the user gives a range. One line per turn since the last report: `user` is the turn, `agent` the end of the text before it. Empty file: say so and stop.
2. **Labels.** One line per correction in `<scratchpad>/labels.jsonl`: `{"id", "type", "words", "quote", "did"}`. `type` is a code from the table, or `other` if it only fits by forcing it; `words` the user's words copied exactly from `user`; `quote` the same in English, at most 20 words; `did` what the agent had done, in one line. Several complaints in the same turn: a single line, on the main point.
3. **Confirmation.** A page with `kulmine:pages`, type `report`: the turns read, each error type with its habit in a few words, and one row per correction (quote, what the agent had done, proposed error type) with `data-k-options` option buttons on the codes, `other` and `not a correction`. In the page's reply the user adds the missing corrections. Apply the reply to `labels.jsonl`.
4. **Report.** `python3 "${CLAUDE_SKILL_DIR}/scripts/count.py" <scratchpad>/turns.jsonl <scratchpad>/labels.jsonl > <scratchpad>/report.md`; if it flags wrong labels, fix them and run it again. Append `## Candidates for a new error type`: every cause that corrections from two or more sessions share and no error type names, with one quote per session, or `None.`. Copy it to `~/.kulmine/corrections/<today>.md` (`<today>T<HHMM>.md` if it already exists).
5. **Outcome.** Update the same page with the total, the error type that changed most since the previous report in corrections per 100 turns, the report's path and the candidates: one becomes an error type only if the user picks it up.

## Session page

1. **Page.** `python3 "${CLAUDE_SKILL_DIR}/scripts/session_page.py" --project <session folder> --grep "<words from the first prompt>" -o <scratchpad>/<name>.html`. The folder comes from the user or, if they name the session by title, from the `cwd` of `mcp__ccd_session_mgmt__list_sessions`. Check that the first message is the prompt the user meant.
2. **Publish** with Artifact, `capabilities: {"db": {}}`, `icon: "chat"`; for a session already reviewed, republish to its `url`, so the comments stay on the messages. Give the link only to the user: the page contains the whole transcript.
3. **Read** when the user is done: `ArtifactData` `list` on `comments` and on `replies` with `query: {"limit": 1000}`, and `ArtifactComments` `read`. A `comments` document opens a thread on message `n` (selected `quote`, `text`, sometimes the first `reply`); a `replies` document is a later turn of it (`comment`, `role`, `text`, `at`). A thread is waiting for you if its last turn by `at` is not `agent`.
4. **Act** on every waiting comment following "Changing the agent setup" in kulmine's `AGENTS.md`; comments with the same cause get a single fix. A question gets an answer and no change.
5. **Answer in the page**, not in chat: an `ArtifactData` `batch` with one `set` in `replies` per thread (new `doc_id`, `{comment, role: "agent", text, at}`, `at` the current ISO time); for platform threads `reply`, then `resolve`. One or two sentences: what changed or why nothing did. In chat, one line.
