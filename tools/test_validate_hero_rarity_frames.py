import importlib.util
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("validate-hero-rarity-frames.py")
SPEC = importlib.util.spec_from_file_location("hero_rarity_validator", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


def family(family_id: str) -> dict:
    return {
        "id": family_id,
        "sheet": {"path": f"families/{family_id}/sheet.png"},
        "frames": [
            {"rank": rank, "path": f"families/{family_id}/frames/rank-{rank}.png"}
            for rank in range(1, 8)
        ],
    }


class ManifestShapeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.manifest = {
            "schema": "summonlab-hero-rarity-frames",
            "status": "approved-visual-source",
            "runtimeStatus": "not-runtime-ready",
            "preferredStartingFamily": "legacy-neutral",
            "familyOrder": list(MODULE.FAMILY_ORDER),
            "families": [family(value) for value in MODULE.FAMILY_ORDER],
        }

    def test_valid_six_family_shape(self) -> None:
        self.assertEqual(MODULE.validate_manifest_shape(self.manifest), [])

    def test_missing_affinity_rank_fails(self) -> None:
        self.manifest["families"][2]["frames"].pop()
        errors = MODULE.validate_manifest_shape(self.manifest)
        self.assertIn("fire must contain ranks 1 through 7 exactly once", errors)

    def test_wrong_preferred_family_fails(self) -> None:
        self.manifest["preferredStartingFamily"] = "neutral"
        errors = MODULE.validate_manifest_shape(self.manifest)
        self.assertIn("preferredStartingFamily must be legacy-neutral", errors)


if __name__ == "__main__":
    unittest.main()
