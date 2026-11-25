import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import vendor  # noqa: E402

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
        self.vendored = self.consumer / "vendor" / "kulmine" / "skill.md"
        self.addCleanup(self.tmp.cleanup)

    def test_nothing_to_do_when_already_current(self):
        self.assertIsNone(vendor.sync(self.source, self.consumer))

    def test_pulls_a_new_commit(self):
        commit(self.source, "skill.md", "second version\n")
        message = vendor.sync(self.source, self.consumer)
        self.assertIn("updated", message)
        self.assertEqual(self.vendored.read_text(), "second version\n")
        self.assertEqual(vendor.vendored_commit(self.consumer), vendor.head_commit(self.source))
        self.assertIsNone(vendor.sync(self.source, self.consumer))

    def test_leaves_a_dirty_worktree_alone(self):
        commit(self.source, "skill.md", "second version\n")
        (self.consumer / "README.md").write_text("changed\n")
        message = vendor.sync(self.source, self.consumer)
        self.assertIn("uncommitted", message)
        self.assertEqual(self.vendored.read_text(), "first version\n")

    def test_leaves_another_branch_alone(self):
        commit(self.source, "skill.md", "second version\n")
        run(self.consumer, "switch", "-c", "feature")
        message = vendor.sync(self.source, self.consumer)
        self.assertIn("branch feature", message)
        self.assertEqual(self.vendored.read_text(), "first version\n")

    def test_ignores_a_project_without_the_subtree(self):
        other = Path(self.tmp.name) / "other"
        other.mkdir()
        run(other, "init", "-b", "main")
        commit(other, "README.md", "other\n")
        self.assertIsNone(vendor.sync(self.source, other))

    def test_source_side_updates_every_registered_project(self):
        run(self.source, "config", "--add", "kulmine.consumer", str(self.consumer))
        commit(self.source, "skill.md", "second version\n")
        cwd = Path.cwd()
        os.chdir(self.source)
        try:
            messages = vendor.source_side()
        finally:
            os.chdir(cwd)
        self.assertEqual(len(messages), 1)
        self.assertEqual(self.vendored.read_text(), "second version\n")

    def test_consumer_side_finds_the_source_from_the_environment(self):
        commit(self.source, "skill.md", "second version\n")
        env = {"CLAUDE_PROJECT_DIR": str(self.consumer), "KULMINE_SOURCE": str(self.source)}
        previous = {key: os.environ.get(key) for key in env}
        os.environ.update(env)
        try:
            messages = vendor.consumer_side()
        finally:
            for key, value in previous.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value
        self.assertEqual(len(messages), 1)
        self.assertEqual(self.vendored.read_text(), "second version\n")


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
        self.assertIn("settings.json", vendor.register(self.consumer))
        hooks = self.read()["hooks"]
        self.assertEqual(
            hooks["SessionStart"][0]["hooks"][0]["command"],
            'python3 -I "$CLAUDE_PROJECT_DIR/vendor/kulmine/hooks/vendor/vendor.py"',
        )
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
