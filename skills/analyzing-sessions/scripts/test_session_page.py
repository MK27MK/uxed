#!/usr/bin/env python3
"""What `session_page.py` puts in the page it builds. Run it with `python3 -m unittest`."""

import json
import os
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
FIXTURE = HERE / "fixtures" / "session.jsonl"


class SessionPage(unittest.TestCase):
    def setUp(self) -> None:
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.home = Path(folder.name)
        self.out = self.home / "page.html"

    def build(self, *args: str) -> dict:
        env = {**os.environ, "HOME": str(self.home)}
        done = subprocess.run([sys.executable, "-I", str(HERE / "session_page.py"), *args, "-o", str(self.out)],
                              env=env, capture_output=True, text=True)
        self.assertEqual(done.returncode, 0, done.stderr)
        page = self.out.read_text()
        self.assertNotIn("/*SESSION*/null", page)
        self.assertNotIn("/*KATEX_CSS*/", page)
        self.assertIn("data:font/woff2;base64,", page, "KaTeX's fonts must travel inside the page")
        script = re.search(r"const SESSION = (.*);\n", page)[1]
        self.assertNotIn("<", script, "a '<' in the data could close the page's script")
        return json.loads(script)

    def test_the_page_holds_the_session_in_order(self) -> None:
        session = self.build(str(FIXTURE))
        self.assertEqual(session["title"], "Add a contact form to the shop page")
        items = session["items"]
        self.assertEqual([item["n"] for item in items], list(range(1, len(items) + 1)))
        self.assertEqual([item["role"] for item in items],
                         ["user", "agent", "tool", "agent", "user", "agent", "user", "user", "agent", "user", "agent", "user",
                          "summary", "user", "user"])
        call = items[2]
        self.assertEqual(call["tool"], "Bash")
        self.assertEqual(call["result"], "<script>alert(1)</script><!-- x -->")
        self.assertEqual(items[4]["text"], "too many fields, only name and email")
        self.assertNotIn("Side note from a subagent.", json.dumps(items))

    def test_only_what_the_user_typed_shows_as_theirs(self) -> None:
        items = self.build(str(FIXTURE))["items"]
        summary, queued, command = items[-3:]
        self.assertTrue(summary["text"].startswith("This session is being continued"))
        self.assertTrue(summary["text"].endswith("Summary line."), "a compaction summary stays whole")
        self.assertEqual(queued["text"], "the SSD is mounted now")
        self.assertEqual(command["text"], "/kulmine:orchestrating think about the signals first")
        self.assertEqual(items[6]["text"], "/model", "a command typed without arguments is the user's too")
        self.assertIn('summary: "Compaction summary"', self.out.read_text())
        self.assertNotIn("<task-notification>done", json.dumps(items))

    def test_project_and_grep_find_the_transcript(self) -> None:
        project = self.home / ".claude" / "projects" / "-work-shop"
        project.mkdir(parents=True)
        (project / "fixture-session.jsonl").write_text(FIXTURE.read_text())
        self.assertEqual(self.build("--project", "/work/shop", "--grep", "CONTACT FORM")["id"], "fixture-session")
        env = {**os.environ, "HOME": str(self.home)}
        done = subprocess.run([sys.executable, "-I", str(HERE / "session_page.py"), "--project", "/work/shop",
                               "--grep", "newsletter", "-o", str(self.out)], env=env, capture_output=True, text=True)
        self.assertNotEqual(done.returncode, 0)
        self.assertIn("no transcript", done.stderr)


if __name__ == "__main__":
    unittest.main()
