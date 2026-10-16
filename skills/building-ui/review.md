# Review the mock

Input: the `mock.html` and `mock.notes.json` from [mock.md](mock.md). Output: the same files, approved by the user.

`<notes>` is `<folder>/mock.notes.json`.

## 1. Serve and open

Start `node scripts/serve.mjs <folder>` in the background, and open the URL it prints as in [Open the shell](SKILL.md#open-the-shell).

## 2. Iterate until approved

Each time the user hands back the turn, work through the notes as in [SKILL.md](SKILL.md#each-time-the-user-hands-back-the-turn). In mock mode:

- Edits, look changes and rules all go into `mock.html`. Bake each style edit into the matching elements' CSS yourself.
- To change or remove an existing rule, edit its entry in `mock.notes.json`.
- Apply each rename by replacing its key with its value in the `data-ui` and `data-mock-root` attributes of `mock.html`. Keep `renames` as it is: it maps each name in code to the name the user chose, and the shell ignores names `mock.html` no longer has.

Repeat until the user approves. Then stop the server and report the folder.

Implement only when the user asks; then follow [implement.md](implement.md).
