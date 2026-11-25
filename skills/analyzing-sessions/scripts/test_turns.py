#!/usr/bin/env python3
"""Which turns `turns.py` extracts from a transcript. Run it with `python3 -m unittest`."""

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
FIXTURE = HERE / "fixtures" / "session.jsonl"


class Turns(unittest.TestCase):
    def setUp(self) -> None:
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.home = Path(folder.name)
        self.project = self.home / ".claude" / "projects" / "-work-shop"
        self.project.mkdir(parents=True)
        (self.project / "fixture-session.jsonl").write_text(FIXTURE.read_text())

    def run_turns(self, *args: str) -> list[dict]:
        env = {**os.environ, "HOME": str(self.home)}
        done = subprocess.run([sys.executable, "-I", str(HERE / "turns.py"), *args], env=env,
                              capture_output=True, text=True)
        self.assertEqual(done.returncode, 0, done.stderr)
        return [json.loads(line) for line in done.stdout.splitlines()]

    def test_only_turns_that_answer_the_agent(self) -> None:
        turns = self.run_turns("--since", "2025-12-01")
        self.assertEqual([t["id"] for t in turns], ["u3", "u7", "u9"])
        self.assertEqual(turns[0]["user"], "too many fields, only name and email")
        self.assertIn("five", turns[0]["agent"])
        self.assertEqual(turns[1]["user"], "[interrupt]")
        self.assertEqual(turns[1]["agent"], "Trimmed it to name and email.\nNow I'll also redesign the header.")
        self.assertEqual(turns[2]["agent"], "Stopped. Anything else?")
        self.assertEqual({t["project"] for t in turns}, {"/work/shop"})

    def test_the_window_starts_where_the_newest_report_ends(self) -> None:
        reports = self.home / ".kulmine" / "corrections"
        reports.mkdir(parents=True)
        (reports / "2025-12-20.md").write_text("# Corrections, 2025-12-19T00:00:00Z to 2025-12-20T00:00:00Z\n")
        (reports / "2026-01-02.md").write_text("# Corrections, 2026-01-01T09:00:00Z to 2026-01-02T10:00:00.000Z\n")
        (reports / "2026-01-03-baseline.md").write_text("# Baseline, 2026-01-03T23:00:00Z\n")
        self.assertEqual([t["id"] for t in self.run_turns()], ["u9"])

    def test_a_forked_copy_adds_nothing(self) -> None:
        (self.project / "fork.jsonl").write_text(FIXTURE.read_text())
        (self.project / "renamed.jsonl").write_text(FIXTURE.read_text().replace('"uuid": "u', '"uuid": "f'))
        self.assertEqual(len(self.run_turns("--since", "2025-12-01")), 3)

    def test_a_session_started_in_a_temporary_folder_is_skipped(self) -> None:
        text = FIXTURE.read_text().replace('"cwd": "/work/shop"', '"cwd": "/private/tmp/run"')
        (self.project / "fixture-session.jsonl").write_text(text)
        self.assertEqual(self.run_turns("--since", "2025-12-01"), [])


if __name__ == "__main__":
    unittest.main()
