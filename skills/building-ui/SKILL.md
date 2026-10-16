---
name: building-ui
description: Design and change UI through an interactive shell. Turn a spec and a low-fidelity sketch, or an existing component, into a high-fidelity mock.html in the project's own style, iterate on it with the user, then implement it. Or open the shell over the running app, where the user inspects, comments on and restyles real elements, and the changes go straight into code and tests. Use when the user invokes /building-ui, asks to mock up a new component or UI element from a sketch, asks to change a component through a mock, asks to implement an approved mock, or asks to review or change the UI of the running app.
---

# Building UI

The shell works in two modes: **App** and **Mock**. Read only the file for the phase you are in, and the sections below that it points to.

## Mock

To work on a component in isolation. Use it for a new component, or when the user explicitly asks to change a component:

| Phase | When | File |
| --- | --- | --- |
| Mock | No mock exists for the component yet. | [mock.md](mock.md) |
| Review | A mock exists and the user has not approved it. | [review.md](review.md) |
| Implement | The user approved the mock and asks to implement it. | [implement.md](implement.md) |

The flow pauses when the user approves the mock. Implement the component only when the user asks.

## App

For changes to UI elements the running app already shows: [app.md](app.md).

Pick mock mode for a new component or when the user explicitly asks to change a component, and app mode for any other change to existing UI. If a request fits both, ask.

## Conventions

`notes.mjs` is `node scripts/notes.mjs`. It reads and updates the notes for both modes: run it with no arguments for its commands. Prefer it to reading or editing the notes JSON yourself. `<notes>` is the notes file of the mode you are in.

Paths starting with `assets/` or `scripts/` are relative to this skill's folder.

## Open the shell

Once the mode's file has started `scripts/serve.mjs` in the background, which prints its URL on port 4870 or the next free one:

1. Open the page the mode's file names in the browser. Prefer the built-in browser pane when it is available.
2. Check once that the shell's toolbar shows and the console has no errors from `/__mock/` routes or, in mock mode, from `mock.html`. Do no further visual QA.
3. End the turn. Do not explain the shell in chat: its `?` button, at the bottom left, shows how to use it.

## Each time the user hands back the turn

1. Run `notes.mjs pending <notes>`. It lists the edits, renames and comments left to handle.
2. **Edits.** Write each style edit into the element's CSS, and each text edit into the matching instance. Then run `notes.mjs clear <notes> edits <id>…`.
3. **Renames.** Apply each rename where the mode's file says.
4. **Comments.** Address each listed comment. A change in look (style, layout, spacing, wording) is an edit: make it now, with no rule. A change in behaviour is a rule: add it with `notes.mjs rule <notes> <id> "<text>"`, or, only when it has several readings that lead to different changes, add the one you would pick with `--assumption`, so the user can confirm it. When you cannot tell what a comment targets, ask in the reply and change nothing. Then reply with `notes.mjs reply <notes> <id> "<text>"`: say what changed, or ask a question. Never resolve comments: only the user resolves them.
5. **Rules.** Treat every rule the user wrote, changed or confirmed as spec, and make the UI obey it. Only the user turns an assumption into spec: never change a rule's `source` yourself, unless the user settles it in a comment or in chat.
6. Apply any changes the user asked for in chat.
7. The page reloads itself when the notes or the UI change. If the user has unsaved edits, the page shows a toast instead; tell them to reload before they edit again, because a stale page overwrites your notes on its next save.
8. Report in chat only what the comment replies do not already say: changes the user asked for in chat, questions, and blockers. Do not restate your replies.

Repeat until the user is done, then stop the server and finish as the mode's file says.

## Rename in code

An element's name in code is its component, its CSS-module class as `stem.local`, a plain class, or its `data-ui` value. Rename the class in its stylesheet and every use, or the `data-ui` value. A new `stem` means renaming the stylesheet file and its imports, and the component too when they share the name. A renamed component also renames its folder to the new name in kebab-case, and its files the way the project names them.

## Implement rules test-first

1. Implement an element only when all its rules are spec. Leave elements with assumptions for the user to confirm in the shell: tell the user that assumptions are left to confirm there, and do not list or ask about them in chat.
2. Run the test-first loop with the project's TDD skill. If the project has none, stop before writing code and ask the user with AskUserQuestion, offering three options:
   - **Stop for now (Recommended)**: end the turn so the user can add a TDD skill.
   - **Continue with TDD, without a skill**: write each test and watch it fail before you implement it.
   - **Continue without TDD**: implement first, then write the tests.
3. Each new or changed rule becomes at least one test, and each removed rule a test that the behaviour is gone.
4. In code, use the project's token wherever a token has exactly the value you would write.
