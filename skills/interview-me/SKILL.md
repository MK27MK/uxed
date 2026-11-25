---
name: interview-me
description: Interviews the user with an HTML page, one question at a time, until nothing ambiguous is left; the finished page is the spec. Use it when you have two or more questions for the user, before implementing something ambiguous, and when the user asks to be interviewed.
---

# Interview

1. **Look on your own first.** Read the code and the git history of the area and look for pitfalls the user doesn't know they have (unwritten conventions, reverted attempts, half-done migrations, behavior the interface doesn't show). Ask only what code and history don't answer.
2. **Page.** With `kulmine:pages`, type `interview`, and `kulmine.interview`. At the top: what you understood and the pitfalls, each with how it changes the work. Questions are ordered by how much the answer changes the architecture; each says why it matters and offers 2 to 4 options with what they change for whoever will use the result, with your recommended one marked: the one with the best result, even if it takes longest to build. Every option is one someone would really pick; if one wins without discussion and the others are compromises, it is not a question: it goes among the decisions you make.
3. **Rounds.** Every round updates the same page: what is decided rises to the top, below it the decisions you make unless the user stops you, and new questions come from the answers.
4. **Spec.** When nothing ambiguous is left, the page becomes the spec, with no more questions: the decisions with their reasons, what you decide, and the implementation prompt. It is the file you hand to whoever implements; with a tracker it becomes an issue with `kulmine:tracking`.
