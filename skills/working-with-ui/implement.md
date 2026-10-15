# Implement the component

Input: an approved `mock.html` and `mock.notes.json`. Output: the component, its tests, and no mock files.

1. Read `mock.notes.json` first. If `edits` is not empty, or a `user` comment has no `agent` reply after it, finish that work as in [review.md](review.md) and get the user's approval before you implement.
2. If any rule's `source` is still `"assumption"`, serve and open the mock as in [review.md](review.md#1-serve-and-open), tell the user that assumptions are left to confirm there, and end the turn. Do not list or ask about them in chat. When the user hands back the turn, start again from step 1.
3. Run the test-first loop with the project's TDD skill. If the project has none, stop before writing code and ask the user with AskUserQuestion, offering three options:
   - **Stop for now (Recommended)**: end the turn so the user can add a TDD skill.
   - **Continue with TDD, without a skill**: write each test and watch it fail before you implement it.
   - **Continue without TDD**: implement first, then write the tests.
4. Treat `mock.notes.json` as the spec. Each behaviour rule becomes at least one test.
5. Name each component and CSS class after its `data-ui` name. For each `renames` entry whose key exists in code, rename it in code to its value. If the entry renames the component itself, also rename its folder to the new name in kebab-case, and its files the way the project names them.
6. Port the look from `mock.html`: move its CSS into the component's stylesheet, using the project's tokens instead of the copied values. Do not port the preview script; build state with the project's own components and data layer.
7. Wire each `data-oos` control to the real effect it names.
8. Compare the running component with the mock in every state the mock reaches, at the same viewport, and fix the differences.
9. Delete `mock.html` and `mock.notes.json` in the same commit as the implementation. The tests are now the spec.
