# Change the running app

Input: the project's app, running in its dev server. Output: the requested changes in code and tests, and no notes left.

Here the code and its tests are the spec of what the app does today. The notes hold only what the user wants different. Rules describe behaviour, never look: style, layout and wording are changed in code directly. Never derive rules for elements the user did not ask about.

`notes.mjs` below is `node scripts/notes.mjs`. `<root>` is the folder that holds the app's stylesheets and sources, such as the frontend package. `<notes>` is `<root>/.uxed/notes.json`.

## 1. Serve and open

1. Find the dev server's URL in the project's docs or scripts. If it is not running, ask the user to start it, or start it in the background when the project documents how.
2. Start `node scripts/serve.mjs --app <dev-server-url> --root <root>` in the background. It prints the proxy URL, on port 4870 or the next free one. It creates `<root>/.uxed/`, which ignores itself in git.
3. The proxy serves the app from its own origin. If the app calls an API on another origin that checks CORS, that API must allow the proxy URL. Tell the user what to allow, or suggest running the proxy on the app's usual port with `--port` while the dev server moves to another one. Never change the API's configuration yourself.
4. Open the proxy URL in the browser. Prefer the built-in browser pane when it is available. Check once that the shell's toolbar shows and the console has no errors from `/__mock/` routes. Do no further visual QA.
5. End the turn. Do not explain the shell in chat: its `?` button, at the bottom left, shows how to use it.

## 2. Each time the user hands back the turn

1. Run `notes.mjs pending <notes> --root <root>`. It lists everything left to do and, for each element, the stylesheets and sources that define it. Read only those files, and never read `<notes>` itself.
2. **Edits.** Run `notes.mjs bake <notes> --root <root>`. It writes each style edit into the element's stylesheet and reports any it could not place. Then, in the lines it changed, replace each raw value with the project's token when a token has exactly that value. Make the text edits and any edit `bake` left in the sources yourself, then run `notes.mjs clear <notes> edits <id>…`.
3. **Renames.** An element's name is its CSS-module class as `stem.local`, a plain class, or a `data-ui` value. Rename it in code: the class in its stylesheet and every use, or the `data-ui` value. A new `stem` means renaming the stylesheet file and its imports, and the component too when they share the name. Then run `notes.mjs clear <notes> renames <id>…`.
4. **Comments.** Address each listed comment. A change in look (style, layout, spacing, wording) is an edit: make it in the stylesheet or source now, with no rule. A change in behaviour is a rule: add it with `notes.mjs rule <notes> <id> "<text>"` and implement it in step 5, or, only when it has several readings that lead to different changes, add the one you would pick with `--assumption`, so the user can confirm it. When you cannot tell what a comment targets, ask in the reply and change nothing. Then reply with `notes.mjs reply <notes> <id> "<text>"`: say what changed, or ask a question. Never resolve comments: only the user resolves them.
5. **Changes.** Implement the changes of each element whose rules are all `spec`, without asking first. Leave elements with assumptions for the user to confirm. Run the test-first loop as in [implement.md](implement.md#implement-the-component), step 3: each new or changed rule becomes at least one test, and each removed rule a test that the behaviour is gone. Then run `notes.mjs implemented <notes> <id>`.
6. The app updates through its dev server, and the page reloads itself when the notes change. If the user has unsaved edits, the page shows a toast instead; tell them to reload before they edit again.
7. Report in chat only what the replies do not already say: questions, blockers, and edits `bake` could not place.

Repeat until the user is done. Then stop the server and delete `<root>/.uxed/`.

## A new component inside the app

The app has no element to point at yet. Draft a mock for it as in [draft.md](draft.md) and review it as in [review.md](review.md). Then implement it as in [implement.md](implement.md), and come back here to adjust it in place.
