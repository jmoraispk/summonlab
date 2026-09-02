#!/usr/bin/env python3
"""Adversarial tests for the one-icon production packet and result verifiers."""

from __future__ import annotations

import hashlib
import json
import struct
import subprocess
import sys
import tempfile
import unittest
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from validate_target import validate  # noqa: E402
from verify_result import verify  # noqa: E402


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
HASH = "a" * 64
JOB_ID = "martial-blade-horizontal-slash-v1"
CANDIDATE_PATH = (
    "assets/wiki/skills/icon-production-v1/candidates/icons/"
    f"{JOB_ID}.png"
)
RESULT_PATH = (
    "assets/wiki/skills/icon-production-v1/results/icons/"
    f"{JOB_ID}.json"
)
TARGET_PATH = (
    "assets/wiki/skills/icon-production-v1/targets/icons/"
    f"{JOB_ID}.json"
)
ASSIGNMENT_PATH = (
    "assets/wiki/skills/icon-production-v1/assignments/icons/"
    f"{JOB_ID}.json"
)


def png(width: int = 1024, height: int = 1024, color_type: int = 6) -> bytes:
    channels = {2: 3, 6: 4}[color_type]

    def chunk(kind: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + kind
            + data
            + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
        )

    rows = b"".join(b"\0" + bytes(width * channels) for _ in range(height))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, color_type, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(rows, level=9))
        + chunk(b"IEND", b"")
    )


def write_json(root: Path, relative: str, value: dict[str, object]) -> Path:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    return path


class Packet:
    def __init__(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name).resolve()
        self.reference_paths = [
            "assets/wiki/skills/icon-production-v1/references/painted-emblem-authority.png",
            "assets/wiki/skills/icon-production-v1/references/geometry-guide.png",
        ]
        references: list[dict[str, str]] = []
        for index, reference_path in enumerate(self.reference_paths):
            data = f"reference-{index}".encode()
            path = self.root / reference_path
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            references.append(
                {
                    "path": reference_path,
                    "purpose": (
                        "Global Painted Emblem visual authority."
                        if index == 0
                        else "Geometry guide for registration and safe zones."
                    ),
                    "contentHash": hashlib.sha256(data).hexdigest(),
                }
            )
        self.target: dict[str, object] = {
            "schemaVersion": "skill-icon-target-v1",
            "jobId": JOB_ID,
            "role": "skill-art",
            "skillTargetId": "martial:blade:horizontal-slash",
            "motifFamily": None,
            "rarity": None,
            "exactPrompt": "Paint one polished sword cutting laterally through the center.",
            "references": references,
            "canvas": {"width": 1024, "height": 1024, "mediaType": "image/png"},
            "output": {"candidatePath": CANDIDATE_PATH, "resultPath": RESULT_PATH},
        }
        self.assignment: dict[str, object] = {
            "schemaVersion": "skill-icon-assignment-v1",
            "assignmentId": f"assignment-{JOB_ID}",
            "jobId": JOB_ID,
            "targetPath": TARGET_PATH,
            "assignmentPath": ASSIGNMENT_PATH,
            "skillVersion": "summonlab-skill-icon-production-v1",
            "assignedAt": "2026-09-01T17:00:00.000Z",
            "retryCeiling": 1,
            "permittedOutputs": {
                "candidatePath": CANDIDATE_PATH,
                "resultPath": RESULT_PATH,
            },
            "forbiddenSharedPaths": [
                "assets/wiki/skills/icon-production-v1/catalog.json",
                "assets/wiki/skills/icon-production-v1/visual-specs.json",
            ],
            "completionContract": {
                "oneTargetOneImage": True,
                "structuredResultRequired": True,
                "sharedFilesMustRemainUntouched": True,
                "selfPromotionForbidden": True,
            },
        }
        self.target_file = write_json(self.root, TARGET_PATH, self.target)
        self.assignment_file = write_json(self.root, ASSIGNMENT_PATH, self.assignment)
        subprocess.run(["git", "init", "-q"], cwd=self.root, check=True)
        subprocess.run(
            ["git", "config", "user.email", "test@example.invalid"],
            cwd=self.root,
            check=True,
        )
        subprocess.run(
            ["git", "config", "user.name", "Verifier Test"], cwd=self.root, check=True
        )
        subprocess.run(["git", "add", "."], cwd=self.root, check=True)
        subprocess.run(["git", "commit", "-qm", "fixture"], cwd=self.root, check=True)
        self.candidate_bytes = png()
        self.candidate_file = self.root / CANDIDATE_PATH
        self.candidate_file.parent.mkdir(parents=True, exist_ok=True)
        self.candidate_file.write_bytes(self.candidate_bytes)
        prompt = self.target["exactPrompt"]
        assert isinstance(prompt, str)
        self.result: dict[str, object] = {
            "schemaVersion": "skill-icon-result-v1",
            "resultId": f"result-{JOB_ID}",
            "jobId": JOB_ID,
            "assignmentId": f"assignment-{JOB_ID}",
            "status": "candidate",
            "exactPrompt": prompt,
            "promptHash": hashlib.sha256(prompt.encode()).hexdigest(),
            "referenceInputs": [
                {"path": item["path"], "contentHash": item["contentHash"]}
                for item in references
            ],
            "output": {
                "path": CANDIDATE_PATH,
                "mediaType": "image/png",
                "width": 1024,
                "height": 1024,
                "bytes": len(self.candidate_bytes),
                "alphaMode": "rgba",
                "contentHash": hashlib.sha256(self.candidate_bytes).hexdigest(),
            },
            "resultPath": RESULT_PATH,
            "findings": [
                {
                    "category": "geometry",
                    "evaluator": "automated",
                    "outcome": "pass",
                    "observation": "Automated geometry inspection passed.",
                },
                {
                    "category": "recognition",
                    "evaluator": "producer",
                    "outcome": "pass",
                    "observation": "The emblem reads at 96 pixels.",
                },
            ],
            "startedAt": "2026-09-01T17:01:00.000Z",
            "completedAt": "2026-09-01T17:02:00.000Z",
            "totalWallTimeMs": 60000,
            "writtenOutputPaths": [CANDIDATE_PATH, RESULT_PATH],
            "noSharedFilesEdited": True,
            "selfPromoted": False,
        }
        self.result_file = write_json(self.root, RESULT_PATH, self.result)

    def close(self) -> None:
        self.temporary.cleanup()

    def rewrite_inputs(self) -> None:
        self.target_file = write_json(self.root, TARGET_PATH, self.target)
        self.assignment_file = write_json(self.root, ASSIGNMENT_PATH, self.assignment)

    def rewrite_result(self) -> None:
        self.result_file = write_json(self.root, RESULT_PATH, self.result)

    def verify(self, *, attempt_count: int = 1) -> dict[str, object]:
        return verify(
            self.target,
            self.assignment,
            self.result,
            self.result_file,
            self.root,
            attempt_count=attempt_count,
            contract_root=REPOSITORY_ROOT,
        )


class SkillIconVerifierTests(unittest.TestCase):
    def setUp(self) -> None:
        self.packet = Packet()

    def tearDown(self) -> None:
        self.packet.close()

    def assert_invalid(self, pattern: str) -> None:
        with self.assertRaisesRegex(ValueError, pattern):
            self.packet.verify()

    def test_accepts_exactly_one_owned_candidate_and_result(self) -> None:
        report = self.packet.verify()
        self.assertEqual(report["verification"], "pass")
        self.assertTrue(self.packet.result["noSharedFilesEdited"])
        self.assertFalse(self.packet.result["selfPromoted"])

    def test_contract_validation_rejects_schema_drift(self) -> None:
        self.packet.target["unexpected"] = True
        self.assert_invalid("contract validation failed")

    def test_individual_art_requires_global_authorities(self) -> None:
        references = self.packet.target["references"]
        assert isinstance(references, list)
        references[0]["purpose"] = "An unrelated texture reference."
        with self.assertRaisesRegex(ValueError, "Painted Emblem"):
            self.packet.verify()

    def test_rejects_target_assignment_mismatch(self) -> None:
        self.packet.assignment["jobId"] = "martial-blade-other-v1"
        self.assert_invalid("contract validation failed|identity")

    def test_rejects_extra_written_paths(self) -> None:
        written = self.packet.result["writtenOutputPaths"]
        assert isinstance(written, list)
        written.append("assets/wiki/skills/icon-production-v1/catalog.json")
        self.assert_invalid("contract validation failed|written")

    def test_preflight_rejects_overwrite_attempts(self) -> None:
        with self.assertRaisesRegex(ValueError, "pre-existing output collision"):
            validate(
                self.packet.target,
                self.packet.assignment,
                self.packet.root,
                contract_root=REPOSITORY_ROOT,
            )

    def test_rejects_missing_exact_prompt(self) -> None:
        del self.packet.result["exactPrompt"]
        self.assert_invalid("contract validation failed|prompt")

    def test_rejects_missing_reference_hash(self) -> None:
        references = self.packet.target["references"]
        assert isinstance(references, list)
        del references[0]["contentHash"]
        self.assert_invalid("contract validation failed|reference")

    def test_rejects_reference_provenance_mismatch(self) -> None:
        inputs = self.packet.result["referenceInputs"]
        assert isinstance(inputs, list)
        inputs[0]["contentHash"] = HASH
        self.assert_invalid("contract validation failed|reference")

    def test_rejects_changed_reference_bytes(self) -> None:
        (self.packet.root / self.packet.reference_paths[0]).write_bytes(b"changed")
        self.assert_invalid("reference hash changed")

    def test_rejects_path_traversal(self) -> None:
        references = self.packet.target["references"]
        assert isinstance(references, list)
        references[0]["path"] = "../painted-emblem-authority.png"
        self.assert_invalid("contract validation failed|unsafe repository path")

    def test_rejects_reference_symlink(self) -> None:
        reference = self.packet.root / self.packet.reference_paths[0]
        real_reference = reference.with_suffix(".real.png")
        reference.rename(real_reference)
        reference.symlink_to(real_reference)
        self.assert_invalid("symbolic link")

    def test_rejects_candidate_symlink(self) -> None:
        real_candidate = self.packet.candidate_file.with_suffix(".real.png")
        self.packet.candidate_file.rename(real_candidate)
        self.packet.candidate_file.symlink_to(real_candidate)
        self.assert_invalid("symbolic link")

    def test_rejects_target_file_symlink(self) -> None:
        real_target = self.packet.target_file.with_suffix(".real.json")
        self.packet.target_file.rename(real_target)
        self.packet.target_file.symlink_to(real_target)
        with self.assertRaisesRegex(ValueError, "symbolic link"):
            validate(
                self.packet.target,
                self.packet.assignment,
                self.packet.root,
                target_path=self.packet.target_file,
                assignment_path=self.packet.assignment_file,
                allow_existing_outputs=True,
                contract_root=REPOSITORY_ROOT,
            )

    def test_rejects_png_without_alpha(self) -> None:
        self.packet.candidate_bytes = png(color_type=2)
        self.packet.candidate_file.write_bytes(self.packet.candidate_bytes)
        output = self.packet.result["output"]
        assert isinstance(output, dict)
        output["bytes"] = len(self.packet.candidate_bytes)
        output["contentHash"] = hashlib.sha256(self.packet.candidate_bytes).hexdigest()
        self.packet.rewrite_result()
        self.assert_invalid("RGBA|alpha")

    def test_rejects_incorrect_dimensions(self) -> None:
        self.packet.candidate_bytes = png(512, 512)
        self.packet.candidate_file.write_bytes(self.packet.candidate_bytes)
        output = self.packet.result["output"]
        assert isinstance(output, dict)
        output.update(
            {
                "width": 512,
                "height": 512,
                "bytes": len(self.packet.candidate_bytes),
                "contentHash": hashlib.sha256(self.packet.candidate_bytes).hexdigest(),
            }
        )
        self.packet.rewrite_result()
        self.assert_invalid("contract validation failed|1024")

    def test_rejects_candidate_hash_or_byte_mismatch(self) -> None:
        output = self.packet.result["output"]
        assert isinstance(output, dict)
        output["contentHash"] = HASH
        self.packet.rewrite_result()
        self.assert_invalid("candidate metadata|contract validation failed")

    def test_candidate_requires_full_size_and_96_pixel_passes(self) -> None:
        findings = self.packet.result["findings"]
        assert isinstance(findings, list)
        findings[1] = {
            "category": "exact-source-persistence",
            "evaluator": "producer",
            "outcome": "pass",
            "observation": "Exact bytes were retained.",
        }
        self.packet.rewrite_result()
        self.assert_invalid("96-pixel inspection")

    def test_rejects_retry_ceiling_violation(self) -> None:
        self.packet.assignment["retryCeiling"] = 0
        with self.assertRaisesRegex(ValueError, "retry ceiling"):
            self.packet.verify(attempt_count=2)

    def test_rejects_invalid_status(self) -> None:
        self.packet.result["status"] = "approved"
        self.assert_invalid("contract validation failed|status")

    def test_rejects_self_promotion(self) -> None:
        self.packet.result["selfPromoted"] = True
        self.assert_invalid("contract validation failed|self-promot")

    def test_rejects_false_no_shared_files_attestation(self) -> None:
        self.packet.result["noSharedFilesEdited"] = False
        self.assert_invalid("contract validation failed|shared")

    def test_rejects_extra_changed_repository_file(self) -> None:
        extra = self.packet.root / "packages/app.ts"
        extra.parent.mkdir(parents=True)
        extra.write_text("changed\n", encoding="utf-8")
        self.assert_invalid("unexpected changed repository paths")

    def test_rejects_result_argument_at_another_path(self) -> None:
        other = self.packet.root / "other.json"
        other.write_text(self.packet.result_file.read_text(), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "RESULT argument"):
            verify(
                self.packet.target,
                self.packet.assignment,
                self.packet.result,
                other,
                self.packet.root,
                attempt_count=1,
                contract_root=REPOSITORY_ROOT,
            )


if __name__ == "__main__":
    unittest.main()
