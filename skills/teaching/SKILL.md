---
name: teaching
description: Teaches the user a topic, a domain, a concept or a piece of code with an HTML page that shows them what they don't know they don't know and gives them the words to ask for it. Use it when the user asks to understand, study or learn something, what a term or a passage means, or has to work in a field they don't know.
---

# Teaching

**Source.** If the user is studying from a source (book, course, article, document), follow it: its order, its notation, its examples, with the reference for every claim. Otherwise read primary sources (official documentation, code, specifications) and cite them. Mark as your own whatever doesn't come from a source.

**Page** (`kulmine:pages`, type `teaching`), in this order:

1. **Mental model**: the topic in 3-5 steps, before any detail.
2. **Vocabulary ladder**: from the simplest term to the most technical, each with what it means, why it matters and how you'd say it in a prompt.
3. **Sandbox**, when the topic has something to touch: a live object with controls on which the effect of each term shows.
4. **Mines**: what the user would have found out the hard way, one card each with the sentence to add to the prompt.
5. **Final prompt**: the user's request rewritten with the page's vocabulary, in the page's reply.

The project's own terms go in `GLOSSARY.md` with `kulmine:domain-modeling`.
