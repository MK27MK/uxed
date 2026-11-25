import tempfile
import unittest
from pathlib import Path

import pages

COMPONENT = "<!-- kulmine:component:start -->\n<script>v2</script>\n<!-- kulmine:component:end -->\n"


class InlineTest(unittest.TestCase):
    def test_replaces_placeholder(self):
        out = pages.inline("<title>T</title>\n<!-- kulmine:component -->\n<script>page</script>", COMPONENT)
        self.assertIn("<script>v2</script>", out)
        self.assertNotIn(pages.PLACEHOLDER, out)
        self.assertLess(out.index("v2"), out.index("page"))

    def test_updates_existing_block_once(self):
        old = "<p>a</p>\n<!-- kulmine:component:start -->\n<script>v1</script>\n<!-- kulmine:component:end -->\n<p>b</p>"
        out = pages.inline(old, COMPONENT)
        self.assertEqual(out.count("kulmine:component:start"), 1)
        self.assertIn("v2", out)
        self.assertNotIn("v1", out)
        self.assertTrue(out.endswith("<p>b</p>"))

    def test_idempotent(self):
        once = pages.inline("<!-- kulmine:component -->", COMPONENT)
        self.assertEqual(pages.inline(once, COMPONENT), once)

    def test_missing_placeholder_is_an_error(self):
        with self.assertRaises(ValueError):
            pages.inline("<p>nothing</p>", COMPONENT)

    def test_real_component_has_markers(self):
        text = pages.COMPONENT.read_text(encoding="utf-8")
        self.assertTrue(pages.BLOCK.fullmatch(text.strip()), "component.html must be a single start/end block")


class PathTest(unittest.TestCase):
    def test_path_is_slugged_and_created(self):
        with tempfile.TemporaryDirectory() as d:
            p = pages.page_path(Path(d), "Interview", "Export annotations!")
            self.assertEqual(p, Path(d) / ".kulmine/pages/interview/export-annotations.html")
            self.assertTrue(p.parent.is_dir())
            self.assertFalse((Path(d) / ".kulmine/pages/.gitignore").exists())

    def test_tracker_ignores_working_copies(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / ".kulmine").mkdir()
            (Path(d) / ".kulmine/config.json").write_text('{"tracker": {"kind": "linear", "team": "ENG"}}')
            pages.page_path(Path(d), "plan", "x")
            self.assertEqual((Path(d) / ".kulmine/pages/.gitignore").read_text(), "*\n")


class ConfigTest(unittest.TestCase):
    def test_defaults_without_file(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(pages.config(Path(d)), {"language": "en", "tracker": None})

    def test_file_overrides_defaults(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / ".kulmine").mkdir()
            (Path(d) / ".kulmine/config.json").write_text('{"language": "it"}')
            self.assertEqual(pages.config(Path(d)), {"language": "it", "tracker": None})

    def test_incomplete_tracker_is_an_error(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / ".kulmine").mkdir()
            (Path(d) / ".kulmine/config.json").write_text('{"tracker": {"kind": "linear"}}')
            with self.assertRaises(ValueError):
                pages.config(Path(d))


if __name__ == "__main__":
    unittest.main()
