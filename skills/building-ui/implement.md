# Implement the component

Input: an approved `mock.html` and `mock.notes.json`. Output: the component, its tests, and no mock files.

1. Run `notes.mjs pending <folder>/mock.notes.json` first. If it lists anything, finish that work as in [review.md](review.md) and get the user's approval before you implement.
2. If any rule's `source` is still `"assumption"`, serve and open the mock as in [review.md](review.md#1-serve-and-open), tell the user as in [Implement rules test-first](SKILL.md#implement-rules-test-first), and end the turn. When the user hands back the turn, start again from step 1.
3. Treat `mock.notes.json` as the spec, and implement its rules as in [Implement rules test-first](SKILL.md#implement-rules-test-first).
4. Name each component and CSS class after its `data-ui` name. For each `renames` entry whose key exists in code, rename it to its value as in [Rename in code](SKILL.md#rename-in-code).
5. Port the look from `mock.html`: move its CSS into the component's stylesheet, using the project's tokens instead of the copied values. Do not port the preview script; build state with the project's own components and data layer.
6. Wire each `data-oos` control to the real effect it names.
7. Compare the running component with the mock in every state the mock reaches, at the same viewport, and fix the differences.
8. Delete `mock.html` and `mock.notes.json` in the same commit as the implementation. The tests are now the spec.
