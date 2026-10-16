# building-ui

Run `/building-ui`, or ask the agent to mock up a component or change the app's UI.

## Mock mode

https://github.com/user-attachments/assets/b045f5f9-5781-47c3-a183-bcce4bd04fa5

Use it to mock a new component from a spec and a sketch, in the project's style, then implement it using TDD, or you can use it to change existing component.

### How to use

1. Give the agent a spec and a sketch, or point it at an existing component. It opens the mock in the shell.
2. Pick elements, write behaviour rules, comment, edit text and style. Message the agent to apply them.
3. Approve the mock, then ask the agent to implement it.

### Example

[Strategy search](../../examples/mock-palette/README.md): three sketches and a spec, and the mock they became.

## App mode

Inspect, comment on, restyle and rename elements of the running app, with the changes written into code and tests.

### How to use

1. Start the app's dev server.
2. Ask the agent to change the running app. It adds a script tag that loads the shell into the app, on the app's own URL, and removes it when you are done.
3. Pick elements, comment, restyle, rename, or ask for a description. Message the agent to write the changes into code and tests.

The shell's `?` button lists its controls.
