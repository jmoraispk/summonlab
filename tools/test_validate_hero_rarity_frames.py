import hashlib
import importlib.util
import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path

from PIL import Image


MODULE_PATH = Path(__file__).with_name("validate-hero-rarity-frames.py")
SPEC = importlib.util.spec_from_file_location("hero_rarity_validator", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
CANONICAL_ROOT = REPOSITORY_ROOT / "assets/heroes/visuals/rarity-frames"
CANONICAL_PREFIX = "assets/heroes/visuals/rarity-frames/"
SOURCE_PATH_POLICY = "approved-source-paths-are-immutable-until-explicitly-superseded"
WIND_RANK_7_SOURCE = (
    "assets/heroes/visuals/rarity-frames-v4/candidates/individuals/wind/"
    "wind-rank-7-v2.png"
)
WIND_RANK_7_CANONICAL = CANONICAL_PREFIX + "families/wind/frames/rank-7.png"


def family(family_id: str) -> dict:
    packet = "rarity-frames-v3" if family_id == "legacy-neutral" else "rarity-frames-v4"
    return {
        "id": family_id,
        "sheet": {
            "path": f"families/{family_id}/sheet.png",
            "sourcePath": f"historical/{family_id}/sheet.png",
            "sourcePacket": packet,
        },
        "frames": [
            {
                "rank": rank,
                "path": f"families/{family_id}/frames/rank-{rank}.png",
                "sourcePath": f"historical/{family_id}/rank-{rank}.png",
                "sourcePacket": packet,
            }
            for rank in range(1, 8)
        ],
    }


def _write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() or path.is_symlink():
        path.unlink()
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def _write_text(path: Path, value: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() or path.is_symlink():
        path.unlink()
    path.write_text(value, encoding="utf-8")


def _manifest_images(manifest: dict) -> list[dict]:
    images: list[dict] = []
    for family_record in manifest["families"]:
        images.append(family_record["sheet"])
        images.extend(family_record["frames"])
    return images


def _provider_id(index: int) -> str:
    return f"exec-00000000-0000-4000-8000-{index:012d}.png"


def _build_provider_map(source_by_path: dict[str, dict]) -> dict:
    individuals: dict[str, dict] = {}
    provider_index = 1
    for family_id in ("neutral", "fire", "water", "earth", "wind"):
        family_records: dict[str, object] = {}
        if family_id == "wind":
            family_records["runtime_submission_template"] = (
                "prompts/individuals/wind/runtime-submission-template-exact.txt"
            )
        for rank in range(1, 8):
            if family_id != "neutral" and rank <= 2:
                family_records[str(rank)] = {"shared_from": f"neutral/{rank}"}
                continue
            entry: dict[str, object] = {
                "provider_source": _provider_id(provider_index),
                "prompt": f"prompts/individuals/{family_id}/{family_id}-rank-{rank}-exact.txt",
            }
            provider_index += 1
            if family_id == "wind" and rank == 7:
                source = source_by_path[WIND_RANK_7_CANONICAL]
                entry.update(
                    {
                        "prompt_sha256": "a" * 64,
                        "retained_path": "candidates/individuals/wind/wind-rank-7-v2.png",
                        "sha256": source["canonicalSha256"],
                        "supersedes": {
                            "provider_source": _provider_id(provider_index),
                            "prompt": "prompts/individuals/wind/wind-rank-7-exact.txt",
                            "retained_path": (
                                "references/superseded/wind/wind-rank-7-v1-normalized.png"
                            ),
                            "reason": "dragon heads faced outward",
                        },
                    }
                )
            family_records[str(rank)] = entry
        individuals[family_id] = family_records
    return {
        "status": "approved-visual-source",
        "sheet": {
            "retained_path": "candidates/sheets/gemless-neutral-seven-rank-v1.png",
            "provider_source": _provider_id(99),
            "exact_prompt": "prompts/sheets/gemless-neutral-seven-rank-correction1-exact.txt",
        },
        "individuals": individuals,
    }


def _build_geometry_report(source_by_path: dict[str, dict]) -> dict:
    openings = {
        "neutral": (510, 498, 497, 496, 464, 504, 448),
        "fire": (510, 498, 510, 488, 480, 490, 432),
        "water": (510, 498, 510, 451, 430, 474, 431),
        "earth": (510, 498, 496, 478, 460, 464, 430),
        "wind": (510, 498, 499, 479, 430, 430, 435),
    }
    normalized_ranks = {
        "neutral": (1,),
        "fire": (1, 3, 7),
        "water": (1, 3, 5, 7),
        "earth": (1, 7),
        "wind": (1, 5, 6),
    }
    families: dict[str, dict] = {}
    for family_id, widths in openings.items():
        version_for_rank_7 = 2 if family_id == "wind" else 1
        opening_records = {
            f"{family_id}-rank-{rank}-v{version_for_rank_7 if rank == 7 else 1}.png": width
            for rank, width in enumerate(widths, 1)
        }
        narrowest = min(widths)
        widest = max(widths)
        normalizations: dict[str, dict] = {}
        for rank in normalized_ranks[family_id]:
            filename = f"{family_id}-rank-{rank}-v1.png"
            canonical_path = CANONICAL_PREFIX + f"families/{family_id}/frames/rank-{rank}.png"
            normalizations[filename] = {
                "provider_source": (
                    f"references/geometry-raw/{family_id}/"
                    f"{family_id}-rank-{rank}-v1-provider.png"
                ),
                "provider_sha256": f"{rank}" * 64,
                "scale_x": 1.0,
                "requested_opening_px": opening_records[filename],
                "normalized_sha256": source_by_path[canonical_path]["canonicalSha256"],
                "before_opening_px": opening_records[filename],
            }
        family_record: dict[str, object] = {
            "openings_px": opening_records,
            "narrowest_px": narrowest,
            "widest_px": widest,
            "ratio": round(widest / narrowest, 6),
            "variation_percent": round((widest / narrowest - 1) * 100, 2),
            "passes_20_percent_cap": True,
            "whole_frame_normalizations": normalizations,
        }
        if family_id == "wind":
            family_record["superseded_candidates"] = {
                "wind-rank-7-v1.png": {
                    "reason": (
                        "dragon heads faced outward instead of inward toward the hero opening"
                    ),
                    "retained_path": (
                        "references/superseded/wind/wind-rank-7-v1-normalized.png"
                    ),
                    "provider_source": (
                        "references/geometry-raw/wind/wind-rank-7-v1-provider.png"
                    ),
                    "provider_sha256": "d" * 64,
                    "scale_x": 1.075,
                    "requested_opening_px": 430,
                    "normalized_sha256": (
                        "14c410353cc93c05d5449558222de5323cd2ea54327a7aef70ef3ae19d571356"
                    ),
                    "before_opening_px": 400,
                    "active_replacement": "candidates/individuals/wind/wind-rank-7-v2.png",
                }
            }
        families[family_id] = family_record
    return {
        "method": (
            "median central warm-white opening width at y=520..1117; "
            "complete-frame horizontal scaling only"
        ),
        "canvas": "1024x1536 RGB",
        "allowed_family_ratio": 1.2,
        "normalization_band_px": [430, 510],
        "families": families,
    }


def _build_library_fixture(root: Path) -> None:
    # Isolate the immutable canonical PNGs before per-test hard-link cloning. Tests that
    # replace fixture files can never mutate the repository's approved bytes.
    shutil.copytree(CANONICAL_ROOT / "families", root / "families", copy_function=shutil.copy2)
    shutil.copytree(
        CANONICAL_ROOT / "provenance" / "prompts",
        root / "provenance" / "prompts",
    )
    shutil.copy2(CANONICAL_ROOT / "checksums.sha256", root / "checksums.sha256")

    manifest = json.loads((CANONICAL_ROOT / "manifest.json").read_text(encoding="utf-8"))
    source_map = json.loads(
        (CANONICAL_ROOT / "provenance" / "source-map.json").read_text(encoding="utf-8")
    )
    source_by_path = {record["canonicalPath"]: record for record in source_map["records"]}
    manifest.update(
        {
            "activeWindRank7SourcePath": WIND_RANK_7_SOURCE,
            "activeWindRank7CanonicalPath": WIND_RANK_7_CANONICAL,
            "activeWindRank7Sha256": MODULE.WIND_RANK_7_SHA256,
            "sourcePathPolicy": SOURCE_PATH_POLICY,
        }
    )
    for image in _manifest_images(manifest):
        source = source_by_path[image["path"]]
        image["sourcePath"] = source["sourcePath"]
        image["sourcePacket"] = source["sourcePacket"]
    _write_json(root / "manifest.json", manifest)
    _write_json(root / "provenance" / "source-map.json", source_map)
    _write_json(
        root / "provenance" / "provider-source-map.json",
        _build_provider_map(source_by_path),
    )
    _write_json(
        root / "provenance" / "geometry-report.json",
        _build_geometry_report(source_by_path),
    )


def _record_for_path(manifest: dict, path: str) -> dict:
    return next(record for record in _manifest_images(manifest) if record["path"] == path)


class ManifestShapeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.manifest = {
            "schema": "summonlab-hero-rarity-frames",
            "status": "approved-visual-source",
            "runtimeStatus": "not-runtime-ready",
            "preferredStartingFamily": "legacy-neutral",
            "familyOrder": list(MODULE.FAMILY_ORDER),
            "assetCount": 48,
            "activeWindRank7SourcePath": WIND_RANK_7_SOURCE,
            "activeWindRank7CanonicalPath": WIND_RANK_7_CANONICAL,
            "activeWindRank7Sha256": MODULE.WIND_RANK_7_SHA256,
            "sourcePathPolicy": SOURCE_PATH_POLICY,
            "families": [family(value) for value in MODULE.FAMILY_ORDER],
        }

    def test_valid_six_family_shape(self) -> None:
        self.assertEqual(MODULE.validate_manifest_shape(self.manifest), [])

    def test_missing_affinity_rank_fails(self) -> None:
        self.manifest["families"][2]["frames"].pop()
        errors = MODULE.validate_manifest_shape(self.manifest)
        self.assertIn("fire must contain ranks 1 through 7 exactly once", errors)

    def test_malformed_eighth_frame_fails(self) -> None:
        self.manifest["families"][2]["frames"].append({})
        errors = MODULE.validate_manifest_shape(self.manifest)
        self.assertIn("fire must contain exactly seven frame records", errors)

    def test_wrong_preferred_family_fails(self) -> None:
        self.manifest["preferredStartingFamily"] = "neutral"
        errors = MODULE.validate_manifest_shape(self.manifest)
        self.assertIn("preferredStartingFamily must be legacy-neutral", errors)

    def test_incorrect_asset_count_fails(self) -> None:
        self.manifest["assetCount"] = 47
        errors = MODULE.validate_manifest_shape(self.manifest)
        self.assertIn("assetCount must be 48", errors)

    def test_missing_image_source_identity_fails(self) -> None:
        del self.manifest["families"][0]["sheet"]["sourcePath"]
        errors = MODULE.validate_manifest_shape(self.manifest)
        self.assertIn("legacy-neutral sheet must include sourcePath", errors)

    def test_wrong_source_path_policy_fails(self) -> None:
        self.manifest["sourcePathPolicy"] = "mutable"
        errors = MODULE.validate_manifest_shape(self.manifest)
        self.assertIn(
            "sourcePathPolicy must keep approved source paths immutable until explicitly superseded",
            errors,
        )

    def test_wrong_active_wind_source_fails(self) -> None:
        self.manifest["activeWindRank7SourcePath"] = "wrong.png"
        errors = MODULE.validate_manifest_shape(self.manifest)
        self.assertIn(f"activeWindRank7SourcePath must be {WIND_RANK_7_SOURCE}", errors)


class LibraryContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls._fixture_temp = tempfile.TemporaryDirectory(dir=REPOSITORY_ROOT)
        cls.fixture_root = Path(cls._fixture_temp.name) / "fixture"
        _build_library_fixture(cls.fixture_root)

    @classmethod
    def tearDownClass(cls) -> None:
        cls._fixture_temp.cleanup()

    def setUp(self) -> None:
        self._test_temp = tempfile.TemporaryDirectory(dir=REPOSITORY_ROOT)
        self.root = Path(self._test_temp.name) / "library"
        shutil.copytree(self.fixture_root, self.root, copy_function=os.link)

    def tearDown(self) -> None:
        self._test_temp.cleanup()

    def _read_json(self, relative_path: str) -> dict:
        return json.loads((self.root / relative_path).read_text(encoding="utf-8"))

    def test_valid_library_passes(self) -> None:
        self.assertEqual(MODULE.validate_library(self.root), [])

    def test_disguised_non_png_fails_even_when_hashes_match(self) -> None:
        canonical_path = CANONICAL_PREFIX + "families/legacy-neutral/frames/rank-1.png"
        image_path = self.root / "families/legacy-neutral/frames/rank-1.png"
        image_path.unlink()
        Image.new("RGB", (1024, 1536), "white").save(image_path, format="PPM")
        digest = hashlib.sha256(image_path.read_bytes()).hexdigest()

        manifest = self._read_json("manifest.json")
        _record_for_path(manifest, canonical_path)["sha256"] = digest
        _write_json(self.root / "manifest.json", manifest)
        source_map = self._read_json("provenance/source-map.json")
        source = next(
            record for record in source_map["records"] if record["canonicalPath"] == canonical_path
        )
        source["sourceSha256"] = digest
        source["canonicalSha256"] = digest
        _write_json(self.root / "provenance/source-map.json", source_map)
        checksums = (self.root / "checksums.sha256").read_text(encoding="utf-8")
        old_hash = next(line.split()[0] for line in checksums.splitlines() if canonical_path in line)
        _write_text(self.root / "checksums.sha256", checksums.replace(old_hash, digest, 1))

        errors = MODULE.validate_library(self.root)
        self.assertIn(f"image must use PNG encoding: {canonical_path}", errors)

    def test_arbitrary_manifest_path_fails_exact_path_contract(self) -> None:
        old_path = CANONICAL_PREFIX + "families/fire/frames/rank-3.png"
        new_path = CANONICAL_PREFIX + "families/fire/frames/apex.png"
        old_file = self.root / "families/fire/frames/rank-3.png"
        new_file = self.root / "families/fire/frames/apex.png"
        old_file.rename(new_file)

        manifest = self._read_json("manifest.json")
        _record_for_path(manifest, old_path)["path"] = new_path
        _write_json(self.root / "manifest.json", manifest)
        source_map = self._read_json("provenance/source-map.json")
        next(record for record in source_map["records"] if record["canonicalPath"] == old_path)[
            "canonicalPath"
        ] = new_path
        _write_json(self.root / "provenance/source-map.json", source_map)
        checksums = (self.root / "checksums.sha256").read_text(encoding="utf-8")
        _write_text(self.root / "checksums.sha256", checksums.replace(old_path, new_path))

        errors = MODULE.validate_library(self.root)
        self.assertIn("manifest image paths must match exact canonical path set", errors)

    def test_extra_family_and_png_fail_filesystem_contract(self) -> None:
        extra = self.root / "families/lightning/sheet.png"
        extra.parent.mkdir(parents=True)
        os.link(self.root / "families/fire/sheet.png", extra)

        errors = MODULE.validate_library(self.root)
        self.assertIn("families tree has unexpected family directories: lightning", errors)
        self.assertIn("families tree PNG paths must match exact canonical path set", errors)

    def test_missing_prompt_fails(self) -> None:
        prompt = self.root / "provenance/prompts/legacy-neutral/sheet.txt"
        prompt.unlink()

        errors = MODULE.validate_library(self.root)
        self.assertIn(
            "missing prompt: assets/heroes/visuals/rarity-frames/provenance/prompts/"
            "legacy-neutral/sheet.txt",
            errors,
        )

    def test_manifest_and_source_map_source_identity_must_match(self) -> None:
        manifest = self._read_json("manifest.json")
        canonical_path = CANONICAL_PREFIX + "families/fire/sheet.png"
        _record_for_path(manifest, canonical_path)["sourcePacket"] = "rarity-frames-v4"
        _write_json(self.root / "manifest.json", manifest)

        errors = MODULE.validate_library(self.root)
        self.assertIn(f"manifest source identity mismatch: {canonical_path}", errors)

    def test_inherited_record_must_resolve_to_same_rank_neutral_source(self) -> None:
        source_map = self._read_json("provenance/source-map.json")
        canonical_path = CANONICAL_PREFIX + "families/fire/frames/rank-1.png"
        record = next(
            item for item in source_map["records"] if item["canonicalPath"] == canonical_path
        )
        record["inheritedFrom"] = "water"
        _write_json(self.root / "provenance/source-map.json", source_map)

        errors = MODULE.validate_library(self.root)
        self.assertIn(
            f"inherited source map record must resolve to neutral rank 1: {canonical_path}",
            errors,
        )

    def test_missing_provider_provenance_fails(self) -> None:
        (self.root / "provenance/provider-source-map.json").unlink()
        errors = MODULE.validate_library(self.root)
        self.assertIn("missing provenance/provider-source-map.json", errors)

    def test_malformed_provider_provenance_fails(self) -> None:
        provider_map = self._read_json("provenance/provider-source-map.json")
        del provider_map["individuals"]["neutral"]["1"]["provider_source"]
        _write_json(self.root / "provenance/provider-source-map.json", provider_map)

        errors = MODULE.validate_library(self.root)
        self.assertIn("provider neutral rank 1 must include provider_source", errors)

    def test_missing_geometry_provenance_fails(self) -> None:
        (self.root / "provenance/geometry-report.json").unlink()
        errors = MODULE.validate_library(self.root)
        self.assertIn("missing provenance/geometry-report.json", errors)


if __name__ == "__main__":
    unittest.main()
