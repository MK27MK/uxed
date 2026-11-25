#!/usr/bin/env python3
"""When `docs.py` blocks an edit to the configuration and when `docs_seen.py` lifts it. Run with `python3 -I -m unittest discover -s hooks/docs`."""

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HOOKS = Path(__file__).resolve().parent
sys.path.insert(0, str(HOOKS))
import docs  # noqa: E402

REPO = "/repo"


class Config(unittest.TestCase):
    def test_launch_json_and_work_folders_are_not_config(self) -> None:
        self.assertFalse(docs.is_config("/repo/.claude/launch.json"))
        self.assertFalse(docs.is_config("/repo/.claude/plans/plan.md"))
        self.assertFalse(docs.is_config("/repo/.claude/worktrees/w/README.md"))
        self.assertTrue(docs.is_config("/repo/.claude/worktrees/w/.claude/settings.local.json"))
        self.assertTrue(docs.is_config("/repo/.claude/commands/ship.md"))

    def test_only_claude_codes_own_files_are_config(self) -> None:
        for path in ("/p/.claude/settings.json", "/p/.claude/settings.local.json", "/p/.claude-plugin/plugin.json",
                     "/p/.claude-plugin/marketplace.json", "/p/hooks/hooks.json", "/p/.mcp.json", "/p/CLAUDE.md",
                     "/p/skills/a/SKILL.md", "/p/.claude/agents/critic.md", "/p/agents/critic.md",
                     "/p/output-styles/brief.md"):
            self.assertTrue(docs.is_config(path), path)
        for path in ("/p/.vscode/settings.json", "/p/config/settings.json", "/p/plugin.json", "/p/src/plugin.json",
                     "/p/hooks.json", "/p/config/hooks.json", "/p/marketplace.json", "/p/README.md"):
            self.assertFalse(docs.is_config(path), path)

    def test_a_path_is_judged_after_its_symlinks(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            home = Path(folder).resolve()
            plugin = home / "code" / "kulmine"
            (plugin / "skills" / "a").mkdir(parents=True)
            (home / ".claude" / "skills").mkdir(parents=True)
            (home / ".claude" / "skills" / "kulmine").symlink_to(plugin)
            linked = home / ".claude" / "skills" / "kulmine"
            self.assertFalse(docs.is_config(str(linked / "README.md")))
            self.assertTrue(docs.is_config(str(linked / "skills" / "a" / "SKILL.md")))
            (home / "notes").mkdir()
            (home / "notes" / "settings.json").symlink_to(home / ".claude" / "settings.json")
            self.assertTrue(docs.is_config(str(home / "notes" / "settings.json")))


class Gate(unittest.TestCase):
    def setUp(self) -> None:
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.env = {**os.environ, "CLAUDE_PLUGIN_DATA": folder.name}

    def run_hook(self, script: str, event: dict) -> str:
        event = {"session_id": "s1", "cwd": REPO, **event}
        done = subprocess.run([sys.executable, "-I", str(HOOKS / script)], input=json.dumps(event),
                              capture_output=True, text=True, env=self.env)
        self.assertEqual(done.returncode, 0, done.stderr)
        return done.stdout

    def edit_skill(self) -> str:
        return self.run_hook("docs.py", {"tool_name": "Edit", "tool_input": {"file_path": "/repo/skills/a/SKILL.md"}})

    def test_an_edit_is_denied_with_the_three_ways_to_read(self) -> None:
        out = json.loads(self.edit_skill())["hookSpecificOutput"]
        self.assertEqual(out["permissionDecision"], "deny")
        for way in ("WebFetch", "`curl` in Bash", "claude-code-guide"):
            self.assertIn(way, out["permissionDecisionReason"])

    def test_another_tools_settings_pass(self) -> None:
        edit = {"tool_name": "Edit", "tool_input": {"file_path": "/repo/.vscode/settings.json"}}
        self.assertEqual(self.run_hook("docs.py", edit), "")

    def test_each_way_the_denial_names_lifts_it(self) -> None:
        ways = [
            {"tool_name": "Bash", "tool_input": {"command": "curl -s https://code.claude.com/docs/en/hooks.md"}},
            {"tool_name": "WebFetch", "tool_input": {"url": "https://code.claude.com/docs/llms.txt", "prompt": "x"}},
            {"tool_name": "Agent", "tool_input": {"subagent_type": "claude-code-guide", "prompt": "x"},
             "tool_response": {"status": "completed", "agentId": "a1", "content": []}},
            {"hook_event_name": "SubagentStop", "agent_type": "claude-code-guide", "agent_id": "a1"},
        ]
        for n, way in enumerate(ways):
            session = {"session_id": f"s{n}"}
            denied = self.run_hook("docs.py", {**session, "tool_name": "Write", "tool_input": {"file_path": "/r/SKILL.md"}})
            self.assertIn("deny", denied)
            self.run_hook("docs_seen.py", {**session, **way})
            self.assertEqual(self.run_hook("docs.py", {**session, "tool_name": "Write",
                                                       "tool_input": {"file_path": "/r/SKILL.md"}}), "", way)

    def test_another_tool_call_does_not_lift_it(self) -> None:
        self.run_hook("docs_seen.py", {"tool_name": "Agent", "tool_input": {"subagent_type": "Explore"},
                                       "tool_response": {"status": "completed"}})
        self.run_hook("docs_seen.py", {"hook_event_name": "SubagentStop", "agent_type": "Explore"})
        self.run_hook("docs_seen.py", {"tool_name": "Bash", "tool_input": {"command": "cat README.md"}})
        self.assertIn("deny", self.edit_skill())

    def test_the_guide_sent_to_the_background_does_not_lift_it_before_it_finishes(self) -> None:
        launched = {"status": "async_launched", "agentId": "a1", "description": "x", "prompt": "x", "outputFile": "/tmp/a1"}
        self.run_hook("docs_seen.py", {"hook_event_name": "PostToolUse", "tool_name": "Agent",
                                       "tool_input": {"subagent_type": "claude-code-guide", "prompt": "x"},
                                       "tool_response": launched})
        self.assertIn("deny", self.edit_skill())
        self.run_hook("docs_seen.py", {"hook_event_name": "SubagentStop", "agent_type": "claude-code-guide", "agent_id": "a1"})
        self.assertEqual(self.edit_skill(), "")


if __name__ == "__main__":
    unittest.main()
