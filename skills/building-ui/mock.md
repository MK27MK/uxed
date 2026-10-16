# Mock the component

Input: a spec and one or more sketches, or an existing component to change. Output: `mock.html` and `mock.notes.json` in the component's folder.

## 1. Pick the component folder

- If the prompt names or clearly extends an existing component, use its folder. Build the mock from the component's current code and its behaviour notes from its current tests, never from an old mock in git history.
- Otherwise create `<kebab-name>/` next to the project's existing components. It holds only the mock files for now.
- If two existing components fit equally well, ask which one.

## 2. Learn the style

The sketch gives layout and intent, never visual style. Before writing markup, read:

- The project's global stylesheet or theme, for design tokens.
- The component's own source and styles, if it exists.
- The existing component the sketch most resembles. For example, a new dialog matches an existing dialog.

Copy the tokens you use into the mock's `:root`. Reuse sizes, radii, borders, fonts and spacing exactly.

## 3. Write `mock.html`

Copy `assets/mock.template.html` to `<folder>/mock.html` and replace every `{{…}}` placeholder. `{{COMPONENT_NAME}}` is the folder's name in PascalCase (`file-picker` becomes `FilePicker`).

- Build one frame. Every state the sketches show must be reachable by interacting with it: tabs switch, back returns, rows open a detail view.
- Use plain HTML and CSS, plus one vanilla `<script>` that holds the preview state. No framework, no build step, no network.
- Use realistic placeholder data, shaped like the real domain.
- Put `data-ui="<name>"` on every element the user may want to describe, comment on or restyle: each control, each row, each section. Repeated elements share one name.
- Use the name the element has in code, or the name it will have: the component's name for a component or sub-component (`FilePickerDialog`), and the CSS class name for a plain element inside one (`backButton`). Read existing names from the component's source and stylesheet. Name a new element the way the project names its siblings.
- Put `data-oos="<what it would really do>"` on every control whose real effect needs a backend, another component or real computation, such as saving to a server or adding data to another view. In preview the shell blocks it and shows an "Out of scope" toast. Purely local UI changes, such as switching a tab, opening a detail view or typing in a field, work for real.
- Use real `<button>`, `<a>`, `<input>` and `<label>` elements. Give icon-only buttons an `aria-label`.
- Define `window.mockReveal = (id) => { … }` in the script. It puts the preview in a state that shows an element with that `data-ui` id. The shell calls it to outline an element that the current state hides, for example when the user jumps to an assumption.
- Keep the `/__mock/shell.js` script tag last. Never style or script the shell's `mk-` elements or classes.

## 4. Write `mock.notes.json`

```json
{
  "elements": {
    "<data-ui id>": {
      "behaviour": [{ "text": "On click, …", "source": "spec" }, { "text": "…", "source": "assumption" }],
      "comments": [{ "author": "user", "text": "…", "at": "2026-10-14T10:00:00Z", "resolved": false }]
    }
  },
  "edits": {
    "<data-ui id>": { "style": { "<css property>": "<value>" }, "text": { "<instance index>": "<text>" } }
  },
  "renames": { "<name in code>": "<new name>" }
}
```

- Add one `elements` entry per interactive `data-ui` id. A repeated element gets one entry.
- Write `behaviour` as an ordered list of rules, each one imperative and unambiguous enough to implement directly: trigger, conditions, effects, empty and error states, keyboard. Do not number the text; the shell numbers the rules.
- Set `source` to `"spec"` when the prompt or sketch settles the rule, and to `"assumption"` otherwise. The shell shows assumptions in yellow so the user can find and confirm them.
- Start with `comments: []`, `edits: {}` and `renames: {}`.

Then continue with [review.md](review.md).
