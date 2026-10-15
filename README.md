# uxed

## Install

With [skills](https://github.com/vercel-labs/skills), for any agent:

```
npx skills add MK27MK/uxed
```

### Claude Code

```
/plugin marketplace add MK27MK/uxed
/plugin install uxed@uxed
```

### Codex

```
codex plugin marketplace add MK27MK/uxed
codex plugin add uxed@uxed
```

## Use cases

- Mock a new component from a spec and a sketch, in the project's style, then implement it test-first.
- Change an existing component through a mock.
- Inspect, comment on, restyle and rename elements of the running app, with the changes written into code and tests.

## Usage

Run `/working-with-ui`, or ask the agent to mock up a component or change the app's UI.

### Mock

1. Give the agent a spec and a sketch, or point it at an existing component. It opens the mock in the shell.
2. Pick elements, write behaviour rules, comment, edit text and style. Message the agent to apply them.
3. Approve the mock, then ask the agent to implement it.

### App

1. Start the app's dev server.
2. Ask the agent to change the running app. It adds a script tag that loads the shell into the app, on the app's own URL, and removes it when you are done.
3. Pick elements, comment, restyle, rename, or ask for a description. Message the agent to write the changes into code and tests.

The shell's `?` button lists its controls.
