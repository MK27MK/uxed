#!/usr/bin/env python3
"""What the glossary page's server does to `GLOSSARY.md` and its review state. Run with `python3 -m unittest`.

The server tests bind a port on 127.0.0.1, which Claude Code's sandbox blocks unless local binding is allowed.
"""

import http.server
import json
import os
import subprocess
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import glossary  # noqa: E402

SOURCE = """# Bookshop

The words the shop uses.

## Language

**Shelf**:
Where a book waits to be sold, one per genre.
_Avoid_: Rack, Stand

**Order**: A customer's request for books, paid or not.

**Backlist**:
Books published more than a year ago that still sell.
_Avoid_: Old stock

**Purchase order**:
_Aliases_: PO
A request the shop sends a publisher for books it will stock.
_Avoid_: Restock

## Relationships

- An **Order** holds books from any **Shelf**.
"""


class Glossary(unittest.TestCase):
    def setUp(self) -> None:
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.root = Path(folder.name)
        (self.root / "GLOSSARY.md").write_text(SOURCE)
        self.project = glossary.Project(self.root)
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), glossary.Handler)
        glossary.Handler.project = self.project
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        self.url = f"http://127.0.0.1:{server.server_address[1]}"

    def get(self, path: str) -> dict:
        with urllib.request.urlopen(self.url + path) as response:
            return json.load(response)

    def post(self, path: str, body: dict, header: bool = True) -> tuple:
        request = urllib.request.Request(self.url + path, data=json.dumps(body).encode(), method="POST",
                                         headers={"Content-Type": "application/json", **({"X-Glossary": "1"} if header else {})})
        try:
            with urllib.request.urlopen(request) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            return error.code, error.read().decode()

    def term(self, snapshot: dict, name: str) -> dict:
        return next(t for t in snapshot["terms"] if t["name"] == name)

    def text(self) -> str:
        return (self.root / "GLOSSARY.md").read_text()

    def test_the_page_lists_every_term_with_its_parts_and_the_file_stays_as_written(self) -> None:
        snapshot = self.get("/api/glossary")
        self.assertEqual([t["name"] for t in snapshot["terms"]], ["Shelf", "Order", "Backlist", "Purchase order"])
        self.assertEqual(self.term(snapshot, "Shelf")["avoid"], "Rack, Stand")
        self.assertEqual(self.term(snapshot, "Order")["definition"], "A customer's request for books, paid or not.")
        self.assertEqual({t["status"] for t in snapshot["terms"]}, {"new"})
        self.assertEqual(snapshot["sections"], ["Language"])
        self.assertEqual(glossary.serialize(glossary.parse(SOURCE)), SOURCE)
        po = self.term(snapshot, "Purchase order")
        self.assertEqual((po["aliases"], po["definition"], po["avoid"]),
                         ("PO", "A request the shop sends a publisher for books it will stock.", "Restock"))

    def test_aliases_go_on_the_line_under_the_name_and_count_toward_the_approval(self) -> None:
        shelf = self.term(self.get("/api/glossary"), "Shelf")
        status, snapshot = self.post("/api/save", {"old_name": "Shelf", "base": shelf["hash"], "name": "Shelf",
                                                   "aliases": "Bay,  Case", "definition": shelf["definition"],
                                                   "avoid": shelf["avoid"]})
        self.assertEqual(status, 200)
        self.assertIn("**Shelf**:\n_Aliases_: Bay, Case\nWhere a book waits", self.text())
        self.assertEqual(self.term(snapshot, "Shelf")["status"], "approved")
        (self.root / "GLOSSARY.md").write_text(self.text().replace("_Aliases_: Bay, Case", "_Aliases_: Bay"))
        changed = self.term(self.get("/api/glossary"), "Shelf")
        self.assertEqual((changed["status"], changed["approved"]["aliases"]), ("changed", "Bay, Case"))

    def test_a_word_already_naming_another_term_cannot_be_an_alias(self) -> None:
        status, error = self.post("/api/save", {"name": "Supplier request", "aliases": "po", "definition": "x", "avoid": ""})
        self.assertEqual(status, 400)
        self.assertIn("as an alias of Purchase order", error)
        status, error = self.post("/api/save", {"name": "Stock", "aliases": "Backlist", "definition": "x", "avoid": ""})
        self.assertEqual(status, 400)
        self.assertIn("Backlist is already in the glossary", error)

    def test_this_repositorys_own_glossary_round_trips_byte_for_byte(self) -> None:
        path = HERE.parents[2] / "GLOSSARY.md"
        if not path.exists():
            self.skipTest("this repository has no GLOSSARY.md yet")
        source = path.read_text()
        self.assertEqual(glossary.serialize(glossary.parse(source)), source)

    def test_saving_an_edit_rewrites_only_that_term_and_approves_it(self) -> None:
        shelf = self.term(self.get("/api/glossary"), "Shelf")
        status, snapshot = self.post("/api/save", {"old_name": "Shelf", "base": shelf["hash"], "name": "Shelf",
                                                   "definition": "Where books of one genre wait.", "avoid": "Rack"})
        self.assertEqual(status, 200)
        self.assertEqual(self.text(), SOURCE.replace("Where a book waits to be sold, one per genre.\n_Avoid_: Rack, Stand",
                                                     "Where books of one genre wait.\n_Avoid_: Rack"))
        self.assertEqual(self.term(snapshot, "Shelf")["status"], "approved")
        self.assertEqual(self.term(snapshot, "Order")["status"], "new")

    def test_a_term_the_agent_changes_after_approval_shows_as_changed_with_the_approved_text(self) -> None:
        backlist = self.term(self.get("/api/glossary"), "Backlist")
        self.assertEqual(self.post("/api/approve", {"name": "Backlist", "base": backlist["hash"]})[0], 200)
        self.assertEqual(self.term(self.get("/api/glossary"), "Backlist")["status"], "approved")
        (self.root / "GLOSSARY.md").write_text(self.text().replace("still sell.", "still sell every month."))
        changed = self.term(self.get("/api/glossary"), "Backlist")
        self.assertEqual(changed["status"], "changed")
        self.assertEqual(changed["approved"]["definition"], "Books published more than a year ago that still sell.")

    def test_a_save_over_a_term_changed_on_disk_is_refused(self) -> None:
        order = self.term(self.get("/api/glossary"), "Order")
        (self.root / "GLOSSARY.md").write_text(self.text().replace("paid or not", "once paid"))
        status, _ = self.post("/api/save", {"old_name": "Order", "base": order["hash"], "name": "Order",
                                            "definition": "My version.", "avoid": ""})
        self.assertEqual(status, 409)
        self.assertIn("once paid", self.text())

    def test_a_new_term_goes_after_the_last_term_of_its_section(self) -> None:
        status, snapshot = self.post("/api/save", {"name": "Customer", "definition": "Someone who orders books.",
                                                   "avoid": "Client"})
        self.assertEqual(status, 200)
        self.assertIn("_Avoid_: Restock\n\n**Customer**:\nSomeone who orders books.\n_Avoid_: Client\n\n## Relationships",
                      self.text())
        self.assertEqual(self.term(snapshot, "Customer")["section"], "Language")
        status, error = self.post("/api/save", {"name": "customer", "definition": "Again.", "avoid": ""})
        self.assertEqual(status, 400)
        self.assertIn("already", error)

    def test_a_glossary_that_does_not_exist_yet_is_created_with_the_first_term(self) -> None:
        (self.root / "GLOSSARY.md").unlink()
        self.assertEqual(self.post("/api/save", {"name": "Shelf", "definition": "Where books wait.", "avoid": ""})[0], 200)
        self.assertEqual(self.text(), f"# {self.root.name}\n\n## Language\n\n**Shelf**:\nWhere books wait.\n")

    def test_renaming_carries_the_comments_and_deleting_removes_the_block(self) -> None:
        self.post("/api/comment", {"term": "Order", "text": "Say it can be unpaid."})
        order = self.term(self.get("/api/glossary"), "Order")
        status, snapshot = self.post("/api/save", {"old_name": "Order", "base": order["hash"], "name": "Sale",
                                                   "definition": order["definition"], "avoid": "Order"})
        self.assertEqual(status, 200)
        self.assertEqual(self.term(snapshot, "Sale")["comments"][0]["text"], "Say it can be unpaid.")
        sale = self.term(snapshot, "Sale")
        self.assertEqual(self.post("/api/delete", {"name": "Sale", "base": sale["hash"]})[0], 200)
        self.assertNotIn("Sale", self.text())
        self.assertIn("_Avoid_: Rack, Stand\n\n**Backlist**:", self.text())

    def test_the_agent_reads_open_comments_and_replies_from_the_command_line(self) -> None:
        self.post("/api/comment", {"term": "Shelf", "text": "One per genre is wrong, we mix genres."})
        run = lambda *args: subprocess.run([sys.executable, "-I", str(HERE / "glossary.py"), *args, "--root", str(self.root)],
                                           capture_output=True, text=True, check=True).stdout
        open_comments = [json.loads(line) for line in run("comments").splitlines()]
        self.assertEqual([c["text"] for c in open_comments], ["One per genre is wrong, we mix genres."])
        run("reply", open_comments[0]["id"], "Dropped the genre rule.")
        self.assertEqual(run("comments"), "")
        thread = self.term(self.get("/api/glossary"), "Shelf")["comments"]
        self.assertEqual([(c["by"], c["resolved"]) for c in thread], [("user", True), ("agent", False)])

    def test_an_unknown_command_is_refused(self) -> None:
        unknown = subprocess.run([sys.executable, "-I", str(HERE / "glossary.py"), "nope"], capture_output=True, text=True)
        self.assertEqual(unknown.returncode, 2)

    def test_a_post_from_another_site_is_refused(self) -> None:
        status, _ = self.post("/api/save", {"name": "Spam", "definition": "x", "avoid": ""}, header=False)
        self.assertEqual(status, 403)
        self.assertNotIn("Spam", self.text())


class Start(unittest.TestCase):
    def test_open_starts_one_server_per_repository_and_finds_it_again(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder).resolve()
            subprocess.run(["git", "init", "-q", str(root)], check=True)
            (root / "GLOSSARY.md").write_text(SOURCE)
            (root / "docs").mkdir()
            env = {**os.environ, "GLOSSARY_HOME": str(root / ".home")}
            run = lambda: subprocess.run([sys.executable, "-I", str(HERE / "glossary.py"), "--root", str(root / "docs")],
                                         env=env, capture_output=True, text=True, check=True, timeout=20).stdout
            first, second = run(), run()
            self.assertTrue(first.startswith(f"Glossary of {root.name}: http://127.0.0.1:"), first)
            self.assertEqual(first, second)
            url = first.split(": ", 1)[1].strip()
            with urllib.request.urlopen(url) as response:
                self.assertIn("<title>Glossary</title>", response.read().decode())
            with urllib.request.urlopen(url + "api/ping") as response:
                os.kill(json.load(response)["pid"], 15)


if __name__ == "__main__":
    unittest.main()
