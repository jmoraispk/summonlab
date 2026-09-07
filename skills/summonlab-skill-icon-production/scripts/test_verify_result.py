#!/usr/bin/env python3

from __future__ import annotations

import hashlib
import json
import struct
import sys
import tempfile
import unittest
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from validate_target import FAMILY_PURPOSE, GEOMETRY_PURPOSE, PROMPT_CLAUSE, validate  # noqa: E402
from verify_result import verify  # noqa: E402


def png(width: int = 1024, height: int = 1024, visible: bool = False) -> bytes:
    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    rows = []
    for y in range(height):
        pixels = bytearray(b"\x00\x00\x00\x00" * width)
        if visible and y == height // 2:
            pixel = (width // 2) * 4
            pixels[pixel : pixel + 4] = b"\xff\xff\xff\xff"
        rows.append(b"\0" + bytes(pixels))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(b"".join(rows)))
        + chunk(b"IEND", b"")
    )


class FramelessSkillArtContractTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.job = "martial-blade-measured-cut-v2"
        self.work = self.root / ".skill-icon-work" / self.job
        self.work.mkdir(parents=True)
        asset_root = self.root / "assets/wiki/skills/icon-production-v2"
        asset_root.mkdir(parents=True)
        (asset_root / "interiors").mkdir()
        (asset_root / "frames").mkdir()
        (asset_root / "catalog.json").write_text(
            json.dumps(
                {
                    "schemaVersion": "skill-icon-catalog-v1",
                    "records": [
                        {
                            "targetId": "martial:blade:measured-cut",
                            "name": "Measured Cut",
                            "rarity": "F",
                            "domain": "Martial",
                            "family": "Blade",
                            "motifFamily": "blade.precision-cut",
                            "primaryVisualParent": None,
                        },
                        {
                            "targetId": "martial:blade:quick-cut",
                            "name": "Quick Cut",
                            "rarity": "F",
                            "domain": "Martial",
                            "family": "Blade",
                            "motifFamily": "blade.precision-cut",
                            "primaryVisualParent": None,
                        }
                    ],
                }
            ),
            encoding="utf-8",
        )
        (asset_root / "geometry-guide.png").write_bytes(png(8, 8))
        (asset_root / "interiors/martial-blade-quick-cut.png").write_bytes(png(8, 8))
        (self.work / "family-reference.png").write_bytes(png(8, 8))
        self.target = {
            "schemaVersion": "summonlab-skill-art-target-v1",
            "jobId": self.job,
            "targetId": "martial:blade:measured-cut",
            "name": "Measured Cut",
            "rarity": "F",
            "exactPrompt": f"Paint one controlled diagonal sword cut with a restrained wake. {PROMPT_CLAUSE}",
            "references": [
                self.reference("assets/wiki/skills/icon-production-v2/geometry-guide.png", GEOMETRY_PURPOSE),
                self.reference(f".skill-icon-work/{self.job}/family-reference.png", FAMILY_PURPOSE),
            ],
            "outputPath": f".skill-icon-work/{self.job}/candidate.png",
        }
        self.assignment = {
            "schemaVersion": "summonlab-skill-art-assignment-v1",
            "jobId": self.job,
            "targetId": "martial:blade:measured-cut",
            "targetPath": f".skill-icon-work/{self.job}/target.json",
            "assignmentPath": f".skill-icon-work/{self.job}/assignment.json",
            "candidatePath": f".skill-icon-work/{self.job}/candidate.png",
            "resultPath": f".skill-icon-work/{self.job}/result.json",
            "retryCeiling": 1,
            "selfPromotionForbidden": True,
        }
        self.write_packets()

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def reference(self, path: str, purpose: str) -> dict[str, str]:
        data = (self.root / path).read_bytes()
        return {"path": path, "purpose": purpose, "contentHash": hashlib.sha256(data).hexdigest()}

    def write_packets(self) -> None:
        (self.work / "target.json").write_text(json.dumps(self.target), encoding="utf-8")
        (self.work / "assignment.json").write_text(json.dumps(self.assignment), encoding="utf-8")

    def test_validates_a_temporary_frameless_job_and_candidate_result(self) -> None:
        validate(self.work / "target.json", self.work / "assignment.json", self.root)
        candidate = png(visible=True)
        (self.work / "candidate.png").write_bytes(candidate)
        result = {
            "schemaVersion": "summonlab-skill-art-result-v1",
            "jobId": self.job,
            "targetId": self.target["targetId"],
            "status": "candidate",
            "promptHash": hashlib.sha256(self.target["exactPrompt"].encode()).hexdigest(),
            "referenceInputs": [
                {"path": item["path"], "contentHash": item["contentHash"]}
                for item in self.target["references"]
            ],
            "candidate": {
                "path": self.assignment["candidatePath"],
                "contentHash": hashlib.sha256(candidate).hexdigest(),
                "bytes": len(candidate),
                "width": 1024,
                "height": 1024,
                "alphaMode": "rgba",
            },
            "findings": {
                "fullSize": {"outcome": "pass", "observation": "Layer is clean and frameless."},
                "recognition96": {"outcome": "pass", "observation": "Cut remains recognizable."},
            },
            "attemptCount": 1,
            "noSharedFilesEdited": True,
            "selfPromoted": False,
        }
        (self.work / "result.json").write_text(json.dumps(result), encoding="utf-8")
        verify(self.work / "target.json", self.work / "assignment.json", self.work / "result.json", self.root, 1)

    def test_rejects_frames_as_generation_references(self) -> None:
        frame = self.root / "assets/wiki/skills/icon-production-v2/frames/rarity-frame-f.png"
        frame.write_bytes(png(8, 8))
        self.target["references"].append(self.reference("assets/wiki/skills/icon-production-v2/frames/rarity-frame-f.png", "Frame."))
        self.write_packets()
        with self.assertRaisesRegex(ValueError, "frames and backing"):
            validate(self.work / "target.json", self.work / "assignment.json", self.root)

    def test_allows_the_first_accepted_member_to_omit_a_family_sheet(self) -> None:
        catalog_path = self.root / "assets/wiki/skills/icon-production-v2/catalog.json"
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        catalog["records"][0]["motifFamily"] = "blade.new-standalone-motif"
        catalog_path.write_text(json.dumps(catalog), encoding="utf-8")
        self.target["references"] = self.target["references"][:1]
        self.write_packets()
        validate(self.work / "target.json", self.work / "assignment.json", self.root)

    def test_allows_a_standalone_to_omit_unrelated_same_family_standalones(self) -> None:
        catalog_path = self.root / "assets/wiki/skills/icon-production-v2/catalog.json"
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        catalog["records"][0]["motifFamily"] = None
        catalog["records"][1]["motifFamily"] = None
        catalog_path.write_text(json.dumps(catalog), encoding="utf-8")
        self.target["references"] = self.target["references"][:1]
        self.write_packets()
        validate(self.work / "target.json", self.work / "assignment.json", self.root)

    def test_requires_family_context_when_an_accepted_sibling_exists(self) -> None:
        self.target["references"] = self.target["references"][:1]
        self.write_packets()
        with self.assertRaisesRegex(ValueError, "reference paths"):
            validate(self.work / "target.json", self.work / "assignment.json", self.root)

    def test_rejects_a_prompt_that_requests_scenery(self) -> None:
        self.target["exactPrompt"] = f"Paint a sword in scenery. {PROMPT_CLAUSE}"
        self.write_packets()
        with self.assertRaisesRegex(ValueError, "forbidden"):
            validate(self.work / "target.json", self.work / "assignment.json", self.root)

    def test_rejects_reference_purpose_or_order_drift(self) -> None:
        self.target["references"][1]["purpose"] = "Looks similar."
        self.write_packets()
        with self.assertRaisesRegex(ValueError, "paths, purposes, and order"):
            validate(self.work / "target.json", self.work / "assignment.json", self.root)

    def test_rejects_visible_pixels_on_the_candidate_boundary(self) -> None:
        # A dedicated malformed-boundary fixture is easier to express by rebuilding one visible
        # pixel at the top-left than by relying on alpha-mode metadata alone.
        rows = [bytearray(b"\x00\x00\x00\x00" * 1024) for _ in range(1024)]
        rows[0][0:4] = b"\xff\xff\xff\xff"

        def chunk(kind: bytes, data: bytes) -> bytes:
            return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

        boundary = (
            b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", 1024, 1024, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(b"".join(b"\0" + bytes(row) for row in rows)))
            + chunk(b"IEND", b"")
        )
        (self.work / "candidate.png").write_bytes(boundary)
        result = {
            "schemaVersion": "summonlab-skill-art-result-v1",
            "jobId": self.job,
            "targetId": self.target["targetId"],
            "status": "candidate",
            "promptHash": hashlib.sha256(self.target["exactPrompt"].encode()).hexdigest(),
            "referenceInputs": [
                {"path": item["path"], "contentHash": item["contentHash"]}
                for item in self.target["references"]
            ],
            "candidate": {
                "path": self.assignment["candidatePath"],
                "contentHash": hashlib.sha256(boundary).hexdigest(),
                "bytes": len(boundary),
                "width": 1024,
                "height": 1024,
                "alphaMode": "rgba",
            },
            "findings": {
                "fullSize": {"outcome": "pass", "observation": "Reported clean."},
                "recognition96": {"outcome": "pass", "observation": "Reported visible."},
            },
            "attemptCount": 1,
            "noSharedFilesEdited": True,
            "selfPromoted": False,
        }
        (self.work / "result.json").write_text(json.dumps(result), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "boundary"):
            verify(self.work / "target.json", self.work / "assignment.json", self.work / "result.json", self.root, 1)


if __name__ == "__main__":
    unittest.main()
