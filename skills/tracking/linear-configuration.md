# Connecting a Linear workspace

The claude.ai Linear connector is tied to a single workspace: `whoami` says which. A project that keeps its work in another workspace needs its own MCP server, and the existing one doesn't need disconnecting.

1. **Add the server to the project.** From the project's folder:

   ```bash
   claude mcp add --transport http --scope local linear-<workspace> https://mcp.linear.app/mcp
   ```

   `--scope local` writes it to `~/.claude.json` under that project: it applies only there and stays out of git. If the server must apply to every clone, commit instead a `.mcp.json` in the project with the same URL under `mcpServers`. In a session with the sandbox on, writing `~/.claude.json` is denied: run the command outside the sandbox or in a terminal.

2. **Authenticate it.** The server starts as `Needs authentication`. Run `claude` in the project's folder, open `/mcp`, pick `linear-<workspace>` and press Authenticate, signing in to the right workspace in the browser. `claude mcp list` must then say `✔ Connected`.

3. **Restart.** The `mcp__linear-<workspace>__*` tools exist only in sessions started afterwards: the running one keeps seeing the old connector. With several Linear servers in a session, the tracker's tools are those of the project's server, not those of the claude.ai connector.

4. **Declare the tracker.** In the project's `.kulmine/config.json`:

   ```json
   {"tracker": {"kind": "linear", "team": "<KEY>"}}
   ```

   `list_teams` on the new server gives the team's key; `list_issue_statuses` and `list_issue_labels` say which states and type labels `kulmine:tracking` will use.
