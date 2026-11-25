# Common AI errors

The families of model defaults the user corrects most often. The method that uses them is in [AGENTS.md](../AGENTS.md).

- **What a correction sounds like**: the user's words.
- **Best constraint level**: the highest level whose mechanism can decide when the default kicks in.
- **Where the remedy lives**: the files that currently hold a remedy for the family, or none.

| Code | The default | What a correction sounds like | Best constraint level | Where the remedy lives |
| --- | --- | --- | --- | --- |
| `INFO.RED` | Restates what is already there | "I can already see it", "that's repeated", "it's already in X" | kulmine style | `output-styles/kulmine.md`, `AGENTS.md` |
| `INFO.REL` | Uses a piece of information because it is in the context | "that wasn't a request", "that wasn't needed", "it's as if it covered everything with ADRs", "it does much more, that's just one part" | kulmine style | `output-styles/kulmine.md`, `skills/domain-modeling` |
| `INFO.PLA` | Puts a remedy where the error was seen, cut to that single case | "wrong level", "use generic examples. Always.", "this hook is overfitted", "this rule generalizes badly to shared projects" | `AGENTS.md` | `AGENTS.md` |
| `INFO.SRC` | Acts from memory or with its own version instead of the source that exists | "did you use X?", "there's already one", "of course you have to read it", "are these tests reliable?" | Hook for facts about Claude Code, skill for the rest | `hooks/docs/docs.py`, `output-styles/kulmine.md`, `skills/researching`, `skills/domain-modeling` |
| `BEH.REP` | Long, structured replies and pages, in the language read last, with terms the reader doesn't have | "message too long, I got lost", "I can't spend an hour reading AI slop", "answer in my language", "you didn't define X", "which model?", "answer in one sentence, not in lists" | Hook for the chat format, kulmine style for the rest | `hooks/chat/chat.py`, `output-styles/kulmine.md`, `skills/wait-what`, `skills/analyzing-sessions` |
| `BEH.SYC` | Goes along or stays vague instead of taking a position | "be more decisive", "tell me what you think" | kulmine style | `output-styles/kulmine.md` |
| `BEH.ASK` | Asks and decides in the form that costs the user most | "too many questions", "I don't know" followed by a decision the user didn't make | Skill | `output-styles/kulmine.md`, `skills/interview-me`, `skills/prototyping`, `skills/orchestrate` |
| `BEH.DEL` | Declares work ready without having used it, or leaves the rest to others | "it doesn't work", "did you try it?", "do I have to ask you?", "fix the test and commit", "commit and push without bothering me" | Hook, then skill | `hooks/issue/issue.py`, `output-styles/kulmine.md`, `skills/tracking`, `skills/orchestrate` |
| `BEH.JUD` | Grades its own work, or lets the test see the answer | "the test didn't have access to…", "these tests look like slop to me", a result the user's labels contradict | Code | `AGENTS.md`, `skills/orchestrate` |
