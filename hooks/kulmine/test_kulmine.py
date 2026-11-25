#!/usr/bin/env python3
"""The languages `kulmine.py` puts in the context. Run with `python3 -I -m unittest discover -s hooks/kulmine`."""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kulmine  # noqa: E402


class LanguagesTest(unittest.TestCase):
    def test_defaults_without_config(self):
        with tempfile.TemporaryDirectory() as d:
            text = kulmine.languages(Path(d))
            self.assertIn("chat, pages and Artifacts in the language of the user's last message", text)
            self.assertIn("issue tracker (titles, descriptions, comments) in `en`", text)
            self.assertIn("in `en`.", text)

    def test_config_found_from_a_subfolder(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / ".kulmine").mkdir()
            (Path(d) / ".kulmine/config.json").write_text('{"language": {"tracker": "it", "work": "de", "chat": "fr"}}')
            (Path(d) / "src").mkdir()
            text = kulmine.languages(Path(d) / "src")
            self.assertIn("Artifacts in `fr`", text)
            self.assertIn("comments) in `it`", text)
            self.assertIn("PRs) in `de`", text)

    def test_broken_config_falls_back_to_defaults(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / ".kulmine").mkdir()
            (Path(d) / ".kulmine/config.json").write_text("{")
            self.assertIn("in `en`", kulmine.languages(Path(d)))


if __name__ == "__main__":
    unittest.main()
