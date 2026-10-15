# Review the mock

Input: a drafted `mock.html` and `mock.notes.json`. Output: the same files, approved by the user.

## 1. Serve and open

1. Start `node scripts/serve.mjs <folder>` in the background. It prints the URL, on port 4870 or the next free one.
2. Open the URL in the browser. Prefer the built-in browser pane when it is available.
3. Check once that the mock renders with no console errors. Do no further visual QA.
4. End the turn. Do not explain the mock in chat: its `?` button, at the bottom left, shows how to use it.

## 2. Iterate until approved

When the user hands back the turn, read `mock.notes.json` and:

1. Bake every `edits` style into the matching elements' CSS, and every `edits` text into the matching instance. Then reset `edits` to `{}`.
2. Replace each `renames` key with its value in the `data-ui` and `data-mock-root` attributes of `mock.html`. Keep `renames` as it is: it maps each name in code to the name the user chose, and the shell ignores names `mock.html` no longer has.
3. Address each unresolved `user` comment that has no `agent` reply after it, by changing the mock, its behaviour, or both. For each one, append an `agent` comment that says what changed or asks a question. Never change `resolved`: only the user resolves comments.
4. Treat every rule the user wrote, changed or confirmed as spec, and make the mock obey it. Only the user turns an assumption into spec: never change a rule's `source` yourself, unless the user settles it in a comment or in chat.
5. Apply any changes the user asked for in chat.
6. Write both files. The page reloads itself when either file changes. If the user has unsaved edits, the page shows a toast instead; tell them to reload before they edit again, because a stale page overwrites your notes on its next save.
7. Report in chat only what the comments do not already say: changes the user asked for in chat, questions, and blockers. Do not restate your comment replies.

Repeat until the user approves. Then stop the server and report the folder.

Implement only when the user asks; then follow [implement.md](implement.md).
