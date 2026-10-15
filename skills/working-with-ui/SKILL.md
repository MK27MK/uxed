---
name: working-with-ui
description: Design and change UI through an interactive shell. Turn a spec and a low-fidelity sketch, or an existing component, into a high-fidelity mock.html in the project's own style, iterate on it with the user, then implement it. Or open the shell over the running app, where the user inspects, comments on and restyles real elements, and the changes go straight into code and tests. Use when the user invokes /working-with-ui, asks to mock up a new component or UI element from a sketch, asks to change a component through a mock, asks to implement an approved mock, or asks to review or change the UI of the running app.
---

# Working with UI

The shell works in two modes. Read only the file for the phase you are in.

**Mock**, for a component that does not exist yet, or a change too large to make in place:

| Phase | When | File |
| --- | --- | --- |
| Draft | No mock exists for the component yet. | [draft.md](draft.md) |
| Review | A mock exists and the user has not approved it. | [review.md](review.md) |
| Implement | The user approved the mock and asks to implement it. | [implement.md](implement.md) |

The flow pauses when the user approves the mock. Implement the component only when the user asks.

**App**, for changes to what the running app already shows: [app.md](app.md).

Pick app mode when the user wants to change existing UI and mock mode when the UI is new. If a request fits both, ask.

`scripts/notes.mjs` reads and updates the notes for both modes: run it with no arguments for its commands. Prefer it to reading or editing the notes JSON yourself.

Paths starting with `assets/` or `scripts/` are relative to this skill's folder.
