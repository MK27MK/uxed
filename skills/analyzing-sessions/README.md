# analyzing-sessions

This skill is still a work in progress.

The skill reads past Claude Code sessions for the user's corrections. Its Count mode labels each correction with an error type from [docs/common-ai-errors.md](../../docs/common-ai-errors.md) and writes the counts to `~/.kulmine/corrections/`; its Session page mode turns a finished session into a page the user comments on message by message. It runs only when the user invokes it.

Still missing before it is ready: a Count with the user confirming the labels (the nightly runs could not), and a scheduled run that follows the current skill instead of files that no longer exist.
