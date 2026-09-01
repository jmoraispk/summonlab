import importlib.util
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("verify-hero-rarity-frame-delivery.py")
MODULE = None
if MODULE_PATH.is_file():
    SPEC = importlib.util.spec_from_file_location("hero_rarity_delivery", MODULE_PATH)
    MODULE = importlib.util.module_from_spec(SPEC)
    assert SPEC and SPEC.loader
    SPEC.loader.exec_module(MODULE)


class DeliveryHelperLogicTests(unittest.TestCase):
    def setUp(self) -> None:
        self.assertIsNotNone(MODULE, "delivery helper module must exist")

    def test_manifest_asset_paths_preserve_sheet_then_rank_order(self) -> None:
        manifest = {
            "families": [
                {
                    "sheet": {"path": "families/fire/sheet.png"},
                    "frames": [
                        {"path": "families/fire/frames/rank-1.png"},
                        {"path": "families/fire/frames/rank-2.png"},
                    ],
                }
            ]
        }
        self.assertEqual(
            MODULE.manifest_asset_paths(manifest),
            (
                "families/fire/sheet.png",
                "families/fire/frames/rank-1.png",
                "families/fire/frames/rank-2.png",
            ),
        )

    def test_http_paths_include_review_page_then_manifest_assets(self) -> None:
        manifest = {
            "families": [
                {
                    "sheet": {
                        "path": "assets/heroes/visuals/rarity-frames/families/fire/sheet.png"
                    },
                    "frames": [],
                }
            ]
        }
        self.assertEqual(
            MODULE.http_paths(manifest),
            (
                "assets/heroes/visuals/rarity-frames/review/",
                "assets/heroes/visuals/rarity-frames/families/fire/sheet.png",
            ),
        )

    def test_scope_logic_accepts_migration_files_and_rejects_runtime_files(self) -> None:
        errors = MODULE.scope_errors(
            [
                "assets/heroes/visuals/rarity-frames/manifest.json",
                "assets/heroes/visuals/rarity-frames-v4/geometry-report.json",
                "docs/decisions/0067-hero-rarity-frames-use-one-canonical-six-family-library.md",
                "tools/verify-hero-rarity-frame-delivery.py",
                "apps/web/src/runtime.ts",
            ]
        )
        self.assertEqual(errors, ["out-of-scope changed path: apps/web/src/runtime.ts"])

    def test_wiki_catalog_logic_reports_exact_mapping_parity(self) -> None:
        wiki = {
            "docs/wiki/README.md": "# Wiki\n\nWiki ID: `wiki.root`\n",
            "docs/wiki/art/frames.md": "# Frames\n\nWiki ID: `art.frames`\n",
        }
        catalog = {
            "entries": [
                {"wikiId": "wiki.root", "path": "docs/wiki/README.md"},
                {"wikiId": "art.frames", "path": "docs/wiki/art/frames.md"},
            ]
        }
        self.assertEqual(MODULE.wiki_catalog_errors(wiki, catalog), [])

    def test_wiki_catalog_logic_rejects_duplicate_ids_and_drift(self) -> None:
        wiki = {
            "docs/wiki/a.md": "Wiki ID: `duplicate.id`\n",
            "docs/wiki/b.md": "Wiki ID: `duplicate.id`\n",
        }
        catalog = {
            "entries": [
                {"wikiId": "duplicate.id", "path": "docs/wiki/a.md"},
                {"wikiId": "missing.id", "path": "docs/wiki/missing.md"},
            ]
        }
        errors = MODULE.wiki_catalog_errors(wiki, catalog)
        self.assertIn("duplicate production Wiki ID: duplicate.id", errors)
        self.assertIn("wiki/catalog ID-to-path mapping differs", errors)


if __name__ == "__main__":
    unittest.main()
