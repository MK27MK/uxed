import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from chat import last_message, problems  # noqa: E402

SCRIPT = Path(__file__).parent / "chat.py"


class Problems(unittest.TestCase):
    def ok(self, text):
        self.assertEqual(problems(text), [], text)

    def bad(self, text, word):
        self.assertTrue(any(word in p for p in problems(text)), (text, problems(text)))

    def test_one_sentence(self):
        self.ok("It turns on now: the bulb had burned out and I replaced it.")

    def test_link_and_code(self):
        self.ok("Three options compared: https://claude.ai/code/artifact/abc.def and `config.py` updated.")
        self.ok("Run this:\n\n```bash\nnpm test\n```")

    def test_quotes(self):
        self.ok('> How many letters are in "pear"?\n4.\n\n> I went to the beach today.\nGlad to hear it, did you have fun?')

    def test_two_sentences(self):
        self.bad("I replaced the bulb. It turns on now.", "sentence")
        self.bad("> Question?\nOne. Two.", "sentence")

    def test_list_heading_table(self):
        self.bad("Two problems:\n- one\n- two", "list")
        self.bad("1. first step", "list")
        self.bad("## Plan\ndo things", "heading")
        self.bad("| a | b |\n|---|---|", "table")

    def test_long_code_and_sentence(self):
        self.bad("```\n1\n2\n3\n4\n```", "code")
        self.bad("a" * 400, "characters")

    def test_lowercase_after_dot_is_one_sentence(self):
        self.ok("I use the prev. version because it works.")


class Transcript(unittest.TestCase):
    def test_reads_text_after_last_tool(self):
        rows = [
            {"type": "user", "message": {"content": "hi"}},
            {"type": "assistant", "message": {"content": [{"type": "text", "text": "Looking."}]}},
            {"type": "assistant", "message": {"content": [{"type": "tool_use", "name": "Bash"}]}},
            {"type": "user", "message": {"content": [{"type": "tool_result"}]}},
            {"type": "assistant", "message": {"content": [{"type": "text", "text": "Done."}]}},
        ]
        with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False) as f:
            f.write("\n".join(json.dumps(r) for r in rows))
        self.assertEqual(last_message({"transcript_path": f.name}), "Done.")
        os.unlink(f.name)

    def test_prefers_field(self):
        self.assertEqual(last_message({"last_assistant_message": "X.", "transcript_path": "/nope"}), "X.")


class Main(unittest.TestCase):
    def run_hook(self, event):
        r = subprocess.run([sys.executable, str(SCRIPT)], input=json.dumps(event), capture_output=True, text=True)
        return r.stdout.strip()

    def test_blocks(self):
        out = json.loads(self.run_hook({"last_assistant_message": "- one\n- two"}))
        self.assertEqual(out["decision"], "block")

    def test_passes_and_no_loop(self):
        self.assertEqual(self.run_hook({"last_assistant_message": "Done."}), "")
        self.assertEqual(self.run_hook({"last_assistant_message": "- one", "stop_hook_active": True}), "")


if __name__ == "__main__":
    unittest.main()
