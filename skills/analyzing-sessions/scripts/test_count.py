#!/usr/bin/env python3
"""What `count.py` prints for correct labels and what it refuses. Run it with `python3 -m unittest`."""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
# A error types table like the one in common-ai-errors.md: only the code that opens a row names an error type.
MISTAKES = """# Common AI errors

Each row is an error type; `BEH.JUD` named in the text is not.

| Code | The habit | What a correction sounds like |
|---|---|---|
| `INFO.SRC` | Acts from memory instead of the source | "did you read it?", close to `INFO.RED` |
| `BEH.REP` | Long replies | "too long" |
| `BEH.ASK` | Asks in the form that costs the user most | "too many questions" |
"""
TURNS = [
    {"id": "t1", "project": "/work/shop", "session": "aaaaaaaa-1", "time": "2026-01-01T09:00:00.000Z",
     "agent": "Done: five fields.", "user": "too many fields,\nonly name and email"},
    {"id": "t2", "project": "/work/shop/.claude/worktrees/fix-x", "session": "bbbbbbbb-2",
     "time": "2026-01-02T10:00:00.000Z", "agent": "Long report.", "user": "tldr?"},
    {"id": "t3", "project": "/work/blog", "session": "bbbbbbbb-2", "time": "2026-01-03T11:00:00.000Z",
     "agent": "Shall I commit?", "user": "yes"},
]


class Count(unittest.TestCase):
    def setUp(self) -> None:
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.folder = Path(folder.name)
        (self.folder / "mistakes.md").write_text(MISTAKES)
        (self.folder / "turns.jsonl").write_text("".join(json.dumps(t) + "\n" for t in TURNS))

    def count(self, *labels: dict) -> subprocess.CompletedProcess:
        (self.folder / "labels.jsonl").write_text("".join(json.dumps(label) + "\n" for label in labels))
        return subprocess.run(
            [sys.executable, "-I", str(HERE / "count.py"), str(self.folder / "turns.jsonl"),
             str(self.folder / "labels.jsonl"), "--mistakes", str(self.folder / "mistakes.md")],
            capture_output=True, text=True)

    def test_the_table_counts_corrections_and_sessions_per_error_type(self) -> None:
        done = self.count({"id": "t1", "type": "BEH.REP", "words": "too many fields, only name and email",
                           "quote": "too many fields, only name and email", "did": "The form had five fields."},
                          {"id": "t2", "type": "BEH.REP", "words": "tldr?", "quote": "too long, give me the short version"})
        self.assertEqual(done.returncode, 0, done.stderr)
        lines = done.stdout.splitlines()
        self.assertEqual(lines[0], "# Corrections, 2026-01-01T09:00:00.000Z to 2026-01-03T11:00:00.000Z")
        self.assertIn("3 user turns in 2 sessions; 2 corrections.", lines)
        self.assertIn("| BEH.REP | 2 | 2 |", lines)
        self.assertIn('- BEH.REP — `aaaaaaaa`, shop: "too many fields, only name and email". The form had five fields.', lines)
        self.assertIn('- BEH.REP — `bbbbbbbb`, shop: "too long, give me the short version".', lines)

    def test_the_error_types_are_the_rows_of_the_mistakes_file_in_its_order_then_other(self) -> None:
        done = self.count()
        self.assertEqual(done.returncode, 0, done.stderr)
        rows = [line.split(" | ")[0][2:] for line in done.stdout.splitlines() if line.endswith("| 0 | 0 |")]
        self.assertEqual(rows, ["INFO.SRC", "BEH.REP", "BEH.ASK", "other"])
        self.assertIn("3 user turns in 2 sessions; 0 corrections.", done.stdout)

    def test_a_code_outside_a_row_start_is_not_a_error_type(self) -> None:
        done = self.count({"id": "t1", "words": "too many fields", "type": "INFO.RED", "quote": "too many fields"},
                          {"id": "t2", "words": "tldr?", "type": "BEH.JUD", "quote": "tldr?"})
        self.assertEqual(done.returncode, 1)
        self.assertIn("label 1: 'INFO.RED' is not an error type", done.stderr)
        self.assertIn("label 2: 'BEH.JUD' is not an error type", done.stderr)

    def test_wrong_labels_are_named_and_nothing_is_printed(self) -> None:
        done = self.count({"id": "t1", "words": "too many fields", "type": "Reply form", "quote": "too many fields"},
                          {"id": "t2", "words": "tldr?", "type": "other", "quote": "  "},
                          {"id": "t9", "words": "x", "type": "other", "quote": "x"},
                          {"id": "t3", "words": "yes", "type": "other", "quote": "yes"},
                          {"id": "t3", "words": "yes", "type": "BEH.REP", "quote": "yes"})
        self.assertEqual(done.returncode, 1)
        self.assertEqual(done.stdout, "")
        self.assertIn("label 1: 'Reply form' is not an error type", done.stderr)
        self.assertIn("label 2: the quote is empty", done.stderr)
        self.assertIn("label 3: no turn has the id 't9'", done.stderr)
        self.assertIn("label 5: turn t3 is labelled twice", done.stderr)
        self.assertNotIn("label 4", done.stderr)

    def test_words_not_in_the_turn_are_refused(self) -> None:
        done = self.count({"id": "t1", "type": "BEH.REP", "words": "the agent never ran the tests",
                           "quote": "the agent never ran the tests"})
        self.assertEqual(done.returncode, 1)
        self.assertEqual(done.stdout, "")
        self.assertIn("label 1: the words 'the agent never ran the tests' are not in the user's turn", done.stderr)

    def test_a_long_quote_is_refused(self) -> None:
        words = " ".join(f"w{n}" for n in range(25))
        done = self.count({"id": "t3", "words": "yes", "type": "other", "quote": words})
        self.assertEqual(done.returncode, 1)
        self.assertIn("is 25 words, over 20", done.stderr)

    def test_a_mistakes_file_without_error_type_rows_is_refused(self) -> None:
        (self.folder / "mistakes.md").write_text("- **BEH.REP.001** (2026-01-01): too long.\n")
        done = self.count({"id": "t2", "words": "tldr?", "type": "BEH.REP", "quote": "tldr?"})
        self.assertEqual(done.returncode, 1)
        self.assertEqual(done.stdout, "")
        self.assertIn("has no error type rows", done.stderr)


if __name__ == "__main__":
    unittest.main()
