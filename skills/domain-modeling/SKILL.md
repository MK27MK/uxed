---
name: domain-modeling
description: Build and sharpen a project's domain model. Use when discussing codebase terminology, or writing or editing a GLOSSARY.md.
allowed-tools: Bash(python3 "${CLAUDE_SKILL_DIR}/scripts/glossary.py" *)
---

# Domain Modeling

Actively build and sharpen the project's domain model as you design. This is the *active* discipline: challenging terms, inventing edge-case scenarios, and writing terms into the glossary the moment they crystallise. (Merely *reading* `GLOSSARY.md` for vocabulary is not this skill: that's a one-line habit any skill can do. This skill is for when you're changing the model, not just consuming it.)

## File structure

Most repos have a single context:

```
/
├── GLOSSARY.md
└── src/
```

If a `GLOSSARY-MAP.md` exists at the root, the repo has multiple contexts. The map points to where each one lives:

```
/
├── GLOSSARY-MAP.md
└── src/
    ├── ordering/
    │   └── GLOSSARY.md
    └── billing/
        └── GLOSSARY.md
```

Create files lazily: only when you have something to write. If no `GLOSSARY.md` exists, create one when the first term is resolved.

## During the session

### Challenge against the glossary

When the user uses a term that conflicts with the existing language in `GLOSSARY.md`, call it out immediately. "Your glossary defines 'cancellation' as X, but you seem to mean Y. Which is it?"

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account': do you mean the Customer or the User? Those are different things."

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

### Cross-reference with code

When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: "Your code cancels entire Orders, but you just said partial cancellation is possible. Which is right?"

### Update GLOSSARY.md inline

When a term is resolved, update `GLOSSARY.md` right there. Don't batch these up: capture them as they happen. Use the format in [GLOSSARY-FORMAT.md](./GLOSSARY-FORMAT.md).

`GLOSSARY.md` should be totally devoid of implementation details. Do not treat `GLOSSARY.md` as a spec, a scratch pad, or a repository for implementation decisions. It is a glossary and nothing else.

## The glossary page

`scripts/glossary.py` serves the root `GLOSSARY.md` as a local page where the user edits, comments on and approves terms. Approvals and comments live in `.glossary.json` beside it. The page reads only the root `GLOSSARY.md`, not the per-context ones a `GLOSSARY-MAP.md` points to.

Open comments the user left on the page, one JSON line each:

!`python3 "${CLAUDE_SKILL_DIR}/scripts/glossary.py" comments --root "${CLAUDE_PROJECT_DIR}"`

- **Open.** When the user asks to see or review the glossary, run `python3 "${CLAUDE_SKILL_DIR}/scripts/glossary.py" open --no-open --root <repo>` and give the user the address it prints. If binding a local port fails, run it outside the sandbox.
- **Reply.** Treat each open comment as the user's correction of that term: change the term, or answer without changing it. Then post the answer, which resolves the comment: `python3 "${CLAUDE_SKILL_DIR}/scripts/glossary.py" reply <id> "<what changed, or the answer>" --root <repo>`.
- **Never approve a term yourself**, and leave `.glossary.json` to the page: an approval is the user's sign-off on the exact wording. A term you add or change shows as To review until they approve it.
