import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import vendor  # noqa: E402

for key in ("GIT_AUTHOR_NAME", "GIT_AUTHOR_EMAIL", "GIT_COMMITTER_NAME", "GIT_COMMITTER_EMAIL"):
    os.environ.setdefault(key, "test" if key.endswith("NAME") else "test@example.com")

ENV = {
    **os.environ,
    "GIT_AUTHOR_NAME": "test",
    "GIT_AUTHOR_EMAIL": "test@example.com",
    "GIT_COMMITTER_NAME": "test",
    "GIT_COMMITTER_EMAIL": "test@example.com",
    "GIT_CONFIG_GLOBAL": os.devnull,
    "GIT_CONFIG_SYSTEM": os.devnull,
}


def run(repo, *args):
    return subprocess.run(
        ["git", "-C", str(repo), *args],
        check=True,
        capture_output=True,
        text=True,
        env=ENV,
    )


def commit(repo, name, text):
    (repo / name).write_text(text)
    run(repo, "add", "-A")
    run(repo, "commit", "-m", f"Add {name}")


class VendorSyncTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=os.environ.get("TMPDIR"))
        root = Path(self.tmp.name)
        self.source = root / "kulmine"
        self.consumer = root / "project"
        for repo in (self.source, self.consumer):
            repo.mkdir()
            run(repo, "init", "-b", "main")
        commit(self.source, "skill.md", "first version\n")
        commit(self.consumer, "README.md", "project\n")
        run(
            self.consumer,
            "subtree",
            "add",
            "--prefix",
            "vendor/kulmine",
            str(self.source),
            "main",
            "--squash",
        )
        self.source_url = str(self.source)
        self.vendored = self.consumer / "vendor" / "kulmine" / "skill.md"
        self.addCleanup(self.tmp.cleanup)

    def update(self):
        return vendor.update(self.consumer, self.source_url)

    def head(self, repo):
        return run(repo, "rev-parse", "HEAD").stdout.strip()

    def test_nothing_to_do_when_already_current(self):
        self.assertIsNone(self.update())

    def test_pulls_a_new_commit(self):
        commit(self.source, "skill.md", "second version\n")
        self.assertIn("updated", self.update() or "")
        self.assertEqual(self.vendored.read_text(), "second version\n")
        self.assertEqual(vendor.vendored_commit(self.consumer), self.head(self.source))
        self.assertIsNone(self.update())

    def test_commits_the_registered_hooks(self):
        (self.source / "hooks").mkdir()
        (self.source / "output-styles").mkdir()
        (self.source / "output-styles/kulmine.md").write_text("# kulmine\n")
        (self.source / "hooks/hooks.json").write_text(json.dumps({"hooks": {"Stop": [
            {"hooks": [{"type": "command", "command": 'python3 "${CLAUDE_PLUGIN_ROOT}/hooks/chat/chat.py"'}]}]}}))
        run(self.source, "add", "-A")
        run(self.source, "commit", "-m", "Add hooks")
        message = self.update() or ""
        self.assertIn("settings.json", message)
        self.assertEqual(run(self.consumer, "status", "--porcelain").stdout, "")
        settings = json.loads((self.consumer / ".claude/settings.json").read_text())
        self.assertIn("vendor/kulmine/hooks/chat/chat.py", settings["hooks"]["Stop"][0]["hooks"][0]["command"])

    def test_refuses_a_dirty_worktree(self):
        commit(self.source, "skill.md", "second version\n")
        (self.consumer / "README.md").write_text("changed\n")
        with self.assertRaises(RuntimeError):
            self.update()
        self.assertEqual(self.vendored.read_text(), "first version\n")

    def test_unreachable_source_is_an_error(self):
        self.source_url = str(Path(self.tmp.name) / "missing")
        with self.assertRaises(RuntimeError):
            self.update()

    def test_ignores_a_project_without_the_subtree(self):
        other = Path(self.tmp.name) / "other"
        other.mkdir()
        run(other, "init", "-b", "main")
        commit(other, "README.md", "other\n")
        self.assertIsNone(vendor.update(other, self.source_url))


class RegisterTest(unittest.TestCase):
    """Registering the hooks in the project's `settings.json`."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=os.environ.get("TMPDIR"))
        self.consumer = Path(self.tmp.name) / "project"
        plugin = self.consumer / "vendor" / "kulmine"
        (plugin / "hooks").mkdir(parents=True)
        (plugin / "output-styles").mkdir()
        (plugin / "output-styles" / "kulmine.md").write_text("# kulmine\n")
        (plugin / "hooks" / "hooks.json").write_text(
            json.dumps(
                {
                    "hooks": {
                        "UserPromptSubmit": [
                            {
                                "hooks": [
                                    {
                                        "type": "command",
                                        "command": 'python3 "${CLAUDE_PLUGIN_ROOT}/hooks/kulmine/kulmine.py"',
                                        "timeout": 5,
                                    }
                                ]
                            }
                        ],
                        "PreToolUse": [
                            {
                                "matcher": "Edit|Write",
                                "hooks": [
                                    {
                                        "type": "command",
                                        "command": 'python3 "${CLAUDE_PLUGIN_ROOT}/hooks/docs/docs.py"',
                                        "timeout": 5,
                                    }
                                ],
                            }
                        ],
                    }
                }
            )
        )
        self.settings = self.consumer / ".claude" / "settings.json"
        self.addCleanup(self.tmp.cleanup)

    def read(self):
        return json.loads(self.settings.read_text())

    def test_writes_the_vendored_hooks(self):
        self.assertIn("settings.json", vendor.register(self.consumer) or "")
        hooks = self.read()["hooks"]
        self.assertNotIn("SessionStart", hooks)
        prompt = hooks["UserPromptSubmit"][0]["hooks"][0]["command"]
        self.assertTrue(prompt.startswith('[ "$CLAUDE_CODE_REMOTE" != true ] || '))
        self.assertIn("$CLAUDE_PROJECT_DIR/vendor/kulmine/hooks/kulmine/kulmine.py", prompt)
        self.assertEqual(hooks["PreToolUse"][0]["matcher"], "Edit|Write")

    def test_links_the_output_style(self):
        vendor.register(self.consumer)
        style = self.consumer / ".claude" / "output-styles" / "kulmine.md"
        self.assertTrue(style.is_symlink())
        self.assertEqual(style.read_text(), "# kulmine\n")

    def test_is_idempotent(self):
        vendor.register(self.consumer)
        self.assertIsNone(vendor.register(self.consumer))

    def test_keeps_the_project_own_hooks_and_settings(self):
        self.settings.parent.mkdir(parents=True)
        self.settings.write_text(
            json.dumps(
                {
                    "outputStyle": "kulmine",
                    "hooks": {
                        "SessionStart": [
                            {"hooks": [{"type": "command", "command": "bash setup.sh"}]}
                        ],
                        "UserPromptSubmit": [
                            {
                                "hooks": [
                                    {
                                        "type": "command",
                                        "command": 'python3 "$CLAUDE_PROJECT_DIR/vendor/kulmine/hooks/old.py"',
                                    }
                                ]
                            }
                        ],
                    },
                }
            )
        )
        vendor.register(self.consumer)
        settings = self.read()
        self.assertEqual(settings["outputStyle"], "kulmine")
        self.assertEqual(
            settings["hooks"]["SessionStart"][0]["hooks"][0]["command"], "bash setup.sh"
        )
        commands = [
            hook["command"]
            for entry in settings["hooks"]["UserPromptSubmit"]
            for hook in entry["hooks"]
        ]
        self.assertEqual(len(commands), 1)
        self.assertNotIn("old.py", commands[0])

    def test_does_nothing_without_a_vendored_manifest(self):
        (self.consumer / "vendor" / "kulmine" / "hooks" / "hooks.json").unlink()
        self.assertIsNone(vendor.register(self.consumer))
        self.assertFalse(self.settings.exists())


if __name__ == "__main__":
    unittest.main()
