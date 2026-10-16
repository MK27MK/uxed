# Change the running app

Input: the project's app, running in its dev server. Output: the requested changes in code and tests, and no notes left.

Here the code and its tests are the spec of what the app does today. The notes hold only what the user wants different. Never derive rules for elements the user did not ask about.

`<root>` is the folder that holds the app's stylesheets and sources, such as the frontend package. `<notes>` is `<root>/.uxed/notes.json`. Pass `--root <root>` to every `notes.mjs` command that takes it.

## 1. Serve and open

1. Find the URL the user opens the app at, in the project's docs or scripts. If the app is not running, ask the user to start it as they usually do, or start it in the background when the project documents how. Never move it to another port or host.
2. Start `node scripts/serve.mjs --app <app-url> --root <root>` in the background. After its URL it prints the script tag that loads the shell. It creates `<root>/.uxed/`, which ignores itself in git. Only pages on `<app-url>` can use it.
3. Add the script tag to the `<head>` of the document every page of the app renders: the root layout or `_document` in Next.js, `index.html` in Vite, the base template elsewhere. Render it only in development when the code can tell, such as `{process.env.NODE_ENV === "development" && <script … />}` in a JSX layout. If a tag that loads `/__mock/shell.js` is already there from an earlier session, replace it. Keep the tag out of every commit. The app keeps its own origin, so its API calls, storage and cookies work as usual.
4. Open the app's URL as in [Open the shell](SKILL.md#open-the-shell).

## 2. Each time the user hands back the turn

Work through the notes as in [SKILL.md](SKILL.md#each-time-the-user-hands-back-the-turn). In app mode:

- `pending` also lists, for each element, the stylesheets and sources that define it. Read only those files, and never read `<notes>` itself.
- For edits, first run `notes.mjs bake <notes> --root <root>`. It writes each style edit into the element's stylesheet and reports any it could not place. In the lines it changed, use the project's tokens as in [Implement rules test-first](SKILL.md#implement-rules-test-first). Make the text edits and any edit `bake` left in the sources yourself, and report in chat the edits it could not place.
- Rename in code as in [Rename in code](SKILL.md#rename-in-code), then run `notes.mjs clear <notes> renames <id>…`.
- Make look changes in the stylesheet or source.
- Implement the rules as in [Implement rules test-first](SKILL.md#implement-rules-test-first), without asking first. Then run `notes.mjs implemented <notes> <id>`.
- The app updates through its dev server.

When the user is done, also remove the script tag and check that no file in the project still loads `/__mock/shell.js`. After stopping the server, delete `<root>/.uxed/`.
