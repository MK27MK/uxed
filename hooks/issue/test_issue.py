#!/usr/bin/env python3
"""When `issue.py` blocks an edit to a project with a tracker and when `issue_seen.py` lifts it. Run with `python3 -I -m unittest discover -s hooks/issue`."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HOOKS = Path(__file__).resolve().parent
TRACKED = '{"tracker": {"kind": "linear", "team": "ENG"}}'


class Gate(unittest.TestCase):
    def setUp(self) -> None:
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.tmp = Path(folder.name).resolve()
        self.env = {**os.environ, "CLAUDE_PLUGIN_DATA": str(self.tmp / "data")}
        self.repo = self.project("shop", TRACKED)

    def project(self, name: str, config: str | None) -> Path:
        root = self.tmp / name
        (root / "src").mkdir(parents=True)
        if config is not None:
            (root / ".kulmine").mkdir()
            (root / ".kulmine" / "config.json").write_text(config)
        subprocess.run(["git", "init", "-q", "-b", "main", str(root)], check=True)
        return root

    def run_hook(self, script: str, event: dict) -> str:
        event = {"session_id": "s1", "cwd": str(self.tmp), **event}
        done = subprocess.run([sys.executable, "-I", str(HOOKS / script)], input=json.dumps(event),
                              capture_output=True, text=True, env=self.env)
        self.assertEqual(done.returncode, 0, done.stderr)
        return done.stdout

    def edit(self, path: Path, session: str = "s1") -> str:
        return self.run_hook("issue.py", {"session_id": session, "tool_name": "Edit",
                                          "tool_input": {"file_path": str(path)}})

    def test_an_edit_without_an_issue_is_denied_with_the_way_out(self) -> None:
        out = json.loads(self.edit(self.repo / "src" / "a.ts"))["hookSpecificOutput"]
        self.assertEqual(out["permissionDecision"], "deny")
        for words in ("ENG", "kulmine:tracking", "save_issue"):
            self.assertIn(words, out["permissionDecisionReason"])

    def test_projects_without_a_tracker_and_page_copies_pass(self) -> None:
        self.assertEqual(self.edit(self.project("plain", None) / "src" / "a.py"), "")
        self.assertEqual(self.edit(self.project("nulled", '{"tracker": null}') / "src" / "a.py"), "")
        self.assertEqual(self.edit(self.repo / ".kulmine" / "pages" / "plan" / "x.html"), "")

    def test_a_worktree_inside_the_project_is_the_project(self) -> None:
        tree = self.repo / ".claude" / "worktrees" / "w" / "src"
        tree.mkdir(parents=True)
        self.assertIn("deny", self.edit(tree / "a.ts"))

    def test_reading_or_creating_an_issue_of_the_team_lifts_it(self) -> None:
        ways = [
            {"tool_name": "mcp__abc__get_issue", "tool_input": {"id": "ENG-12"}, "tool_response": "{}"},
            {"tool_name": "mcp__claude_ai_Linear__save_issue", "tool_input": {"title": "Add x", "team": "ENG"},
             "tool_response": [{"type": "text", "text": '{"id": "ENG-151"}'}]},
        ]
        for n, way in enumerate(ways):
            session = f"s{n}"
            self.assertIn("deny", self.edit(self.repo / "src" / "a.ts", session))
            self.run_hook("issue_seen.py", {"session_id": session, **way})
            self.assertEqual(self.edit(self.repo / "src" / "a.ts", session), "", way)

    def test_an_issue_of_another_team_or_another_tool_does_not_lift_it(self) -> None:
        self.run_hook("issue_seen.py", {"tool_name": "mcp__abc__get_issue", "tool_input": {"id": "OPS-3"}})
        self.run_hook("issue_seen.py", {"tool_name": "mcp__abc__list_issues", "tool_input": {"team": "ENG"},
                                        "tool_response": '{"issues": [{"id": "ENG-1"}]}'})
        self.assertIn("deny", self.edit(self.repo / "src" / "a.ts"))

    def test_the_branch_of_an_issue_lifts_it(self) -> None:
        subprocess.run(["git", "-C", str(self.repo), "checkout", "-q", "-b", "alice/eng-150-add-x"], check=True)
        self.assertEqual(self.edit(self.repo / "src" / "a.ts"), "")
        subprocess.run(["git", "-C", str(self.repo), "checkout", "-q", "-b", "claude/engine-1"], check=True)
        self.assertIn("deny", self.edit(self.repo / "src" / "a.ts"))


    def prompt(self, cwd: Path, session: str = "s1") -> str:
        out = self.run_hook("issue.py", {"session_id": session, "hook_event_name": "UserPromptSubmit",
                                         "cwd": str(cwd), "prompt": "add x"})
        return json.loads(out)["hookSpecificOutput"]["additionalContext"] if out else ""

    def test_every_prompt_in_a_tracked_project_asks_for_the_issue_first(self) -> None:
        first = self.prompt(self.repo / "src")
        self.assertIn("has no ENG issue yet", first)
        self.assertIn("first move", first)
        self.run_hook("issue_seen.py", {"tool_name": "mcp__abc__get_issue", "tool_input": {"id": "ENG-12"}})
        later = self.prompt(self.repo)
        self.assertNotIn("issue yet", later)
        self.assertIn("work different", later)

    def test_a_prompt_outside_a_tracked_project_adds_nothing(self) -> None:
        self.assertEqual(self.prompt(self.project("plain", None)), "")


if __name__ == "__main__":
    unittest.main()
