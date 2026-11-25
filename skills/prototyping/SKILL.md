---
name: prototyping
description: Shows the user the options instead of describing them - side-by-side directions, a brainstorm of interventions, a clickable mock or a throwaway editor - in an HTML page where they choose with chips and controls. Use it when there are several ways to do something, when the user will only know what they want by seeing it, before building a UI, and when some data is easier to edit than to describe (sorting, triaging, configuring, tuning).
---

# Prototyping

A page with `kulmine:pages`, type `prototype`, with fake but realistic data and without touching the project. Pick the form:

- **Directions**: 3-4 truly different alternatives on the same data, each with its thesis in one sentence and keep/drop chips.
- **Brainstorm**: 8-10 interventions found in the code, from cheapest to most ambitious, each with the file where it originates and a chip to say whether it convinces.
- **Mock**: the clickable interface, with the variants to toggle and the A/B questions below.
- **Throwaway editor**: an interface made for that data (drag, toggle, adjust) that sends only what changed with `kulmine.put`.
