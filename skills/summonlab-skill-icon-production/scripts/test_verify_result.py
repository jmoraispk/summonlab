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

from validate_target import load_json, validate  # noqa: E402
from verify_result import persist_failed_result, verify  # noqa: E402


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
HASH = "a" * 64
JOB_ID = "martial-blade-horizontal-slash-v1"
STYLE_AUTHORITY_PATH = (
    "assets/wiki/skills/rarity-frame-v1/sources/skill-rarity-option-c-v1.png"
)
GEOMETRY_REFERENCE_PATH = (
    "assets/wiki/skills/icon-production-v1/references/geometry-guide.png"
)
CALIBRATION_PATH = (
    "assets/wiki/skills/icon-production-v1/masters/calibration/blade-sweeping-cut.png"
)
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


def png(
    width: int = 1024,
    height: int = 1024,
    color_type: int = 6,
    pattern: str = "center",
) -> bytes:
    channels = {2: 3, 6: 4}[color_type]

    def chunk(kind: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + kind
            + data
            + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
        )

    transparent_pixel = bytes(channels)
    visible_pixel = b"\x8c\x9a\xb0" + (b"\xff" if color_type == 6 else b"")
    empty_row = transparent_pixel * width
    if pattern == "transparent":
        rows = b"".join(b"\0" + empty_row for _ in range(height))
    elif pattern == "center":
        half = min(width, height) // 12
        left = width // 2 - half
        right = width // 2 + half
        painted_row = (
            transparent_pixel * left
            + visible_pixel * (right - left)
            + transparent_pixel * (width - right)
        )
        rows = b"".join(
            b"\0" + (painted_row if height // 2 - half <= y < height // 2 + half else empty_row)
            for y in range(height)
        )
    elif pattern == "corner":
        painted_row = visible_pixel * 96 + transparent_pixel * (width - 96)
        rows = b"".join(b"\0" + (painted_row if y < 96 else empty_row) for y in range(height))
    elif pattern == "full":
        rows = b"".join(b"\0" + visible_pixel * width for _ in range(height))
    else:
        raise ValueError(f"unsupported PNG fixture pattern: {pattern}")
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
            STYLE_AUTHORITY_PATH,
            GEOMETRY_REFERENCE_PATH,
            CALIBRATION_PATH,
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
                        "Global Painted Emblem style authority."
                        if index == 0
                        else (
                            "Geometry guide for registration and safe zones."
                            if index == 1
                            else "Approved motif-family calibration plate."
                        )
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
        geometry = json.loads(
            (REPOSITORY_ROOT / "assets/wiki/skills/icon-production-v1/geometry.json").read_text(
                encoding="utf-8"
            )
        )
        write_json(
            self.root,
            "assets/wiki/skills/icon-production-v1/geometry.json",
            geometry,
        )
        self.catalog: dict[str, object] = {
            "schemaVersion": "skill-icon-catalog-v1",
            "records": [
                {
                    "targetId": "martial:blade:horizontal-slash",
                    "domain": "Martial",
                    "family": "Blade",
                    "name": "Horizontal Slash",
                    "labels": [{"namespace": "Equipment", "value": "Sword"}],
                    "rarity": "F",
                    "type": "A",
                    "requires": "Swordsmanship Novice",
                    "effect": "Wide but shallow.",
                    "mapEntryId": "blade.sweeping-cut",
                    "motifFamily": "blade.sweeping-cut",
                    "primaryVisualParent": None,
                    "status": "mapped",
                    "visualSpec": None,
                    "assets": None,
                    "review": None,
                }
            ],
        }
        self.catalog_file = write_json(
            self.root,
            "assets/wiki/skills/icon-production-v1/catalog.json",
            self.catalog,
        )
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

    def rewrite_catalog(self) -> None:
        self.catalog_file = write_json(
            self.root,
            "assets/wiki/skills/icon-production-v1/catalog.json",
            self.catalog,
        )

    def rebind_role(
        self,
        role: str,
        job_id: str,
        *,
        width: int = 1024,
        height: int = 1024,
        color_type: int = 6,
        pattern: str = "transparent",
    ) -> None:
        if self.candidate_file.exists() or self.candidate_file.is_symlink():
            self.candidate_file.unlink()
        if self.result_file.exists() or self.result_file.is_symlink():
            self.result_file.unlink()
        scope = "calibration" if role == "calibration-plate" else "references"
        candidate_path = (
            f"assets/wiki/skills/icon-production-v1/candidates/{scope}/{job_id}.png"
        )
        result_path = f"assets/wiki/skills/icon-production-v1/results/{scope}/{job_id}.json"
        target_path = f"assets/wiki/skills/icon-production-v1/targets/{scope}/{job_id}.json"
        assignment_path = (
            f"assets/wiki/skills/icon-production-v1/assignments/{scope}/{job_id}.json"
        )
        self.target.update(
            {
                "jobId": job_id,
                "role": role,
                "skillTargetId": None,
                "motifFamily": "blade.sweeping-cut" if role == "calibration-plate" else None,
                "rarity": "F" if role == "rarity-frame" else None,
                "canvas": {"width": width, "height": height, "mediaType": "image/png"},
                "output": {"candidatePath": candidate_path, "resultPath": result_path},
            }
        )
        assignment_id = f"assignment-{job_id}"
        self.assignment.update(
            {
                "assignmentId": assignment_id,
                "jobId": job_id,
                "targetPath": target_path,
                "assignmentPath": assignment_path,
                "permittedOutputs": {
                    "candidatePath": candidate_path,
                    "resultPath": result_path,
                },
            }
        )
        self.candidate_bytes = png(width, height, color_type, pattern)
        self.candidate_file = self.root / candidate_path
        self.candidate_file.parent.mkdir(parents=True, exist_ok=True)
        self.candidate_file.write_bytes(self.candidate_bytes)
        output = {
            "path": candidate_path,
            "mediaType": "image/png",
            "width": width,
            "height": height,
            "bytes": len(self.candidate_bytes),
            "alphaMode": "rgba" if color_type == 6 else "rgb",
            "contentHash": hashlib.sha256(self.candidate_bytes).hexdigest(),
        }
        self.result.update(
            {
                "resultId": f"result-{job_id}",
                "jobId": job_id,
                "assignmentId": assignment_id,
                "output": output,
                "resultPath": result_path,
                "writtenOutputPaths": [candidate_path, result_path],
            }
        )
        self.result_file = write_json(self.root, result_path, self.result)

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

    def test_one_spoofing_reference_cannot_satisfy_multiple_authorities(self) -> None:
        references = self.packet.target["references"]
        inputs = self.packet.result["referenceInputs"]
        assert isinstance(references, list)
        assert isinstance(inputs, list)
        references[:] = [
            {
                **references[0],
                "purpose": (
                    "Global Painted Emblem style authority and geometry guide for registration."
                ),
            }
        ]
        inputs[:] = [
            {
                "path": references[0]["path"],
                "contentHash": references[0]["contentHash"],
            }
        ]
        self.packet.rewrite_result()
        with self.assertRaisesRegex(ValueError, "geometry|calibration|authority"):
            self.packet.verify()

    def test_catalog_motif_family_requires_exact_calibration_authority(self) -> None:
        references = self.packet.target["references"]
        inputs = self.packet.result["referenceInputs"]
        assert isinstance(references, list)
        assert isinstance(inputs, list)
        references[:] = [item for item in references if item["path"] != CALIBRATION_PATH]
        inputs[:] = [item for item in inputs if item["path"] != CALIBRATION_PATH]
        self.packet.rewrite_result()
        with self.assertRaisesRegex(ValueError, "calibration"):
            self.packet.verify()

    def test_catalog_parent_must_be_approved_before_dispatch(self) -> None:
        records = self.packet.catalog["records"]
        assert isinstance(records, list)
        records[0]["primaryVisualParent"] = "martial:blade:swordsmanship"
        records.append(
            {
                **records[0],
                "targetId": "martial:blade:swordsmanship",
                "name": "Swordsmanship",
                "primaryVisualParent": None,
            }
        )
        self.packet.rewrite_catalog()
        with self.assertRaisesRegex(ValueError, "parent must be approved"):
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

    def test_rejects_fully_transparent_art_even_with_rgba_header(self) -> None:
        self.packet.candidate_bytes = png(pattern="transparent")
        self.packet.candidate_file.write_bytes(self.packet.candidate_bytes)
        output = self.packet.result["output"]
        assert isinstance(output, dict)
        output["bytes"] = len(self.packet.candidate_bytes)
        output["contentHash"] = hashlib.sha256(self.packet.candidate_bytes).hexdigest()
        self.packet.rewrite_result()
        self.assert_invalid("visible pixels|visible area")

    def test_rejects_visible_art_outside_safe_zone(self) -> None:
        self.packet.candidate_bytes = png(pattern="corner")
        self.packet.candidate_file.write_bytes(self.packet.candidate_bytes)
        output = self.packet.result["output"]
        assert isinstance(output, dict)
        output["bytes"] = len(self.packet.candidate_bytes)
        output["contentHash"] = hashlib.sha256(self.packet.candidate_bytes).hexdigest()
        self.packet.rewrite_result()
        self.assert_invalid("safe region|medallion exclusion")

    def test_accepts_role_valid_calibration_canvas_and_rgb_png(self) -> None:
        self.packet.rebind_role(
            "calibration-plate",
            "blade-sweeping-cut-calibration-v1",
            width=2048,
            height=1024,
            color_type=2,
            pattern="full",
        )
        self.assertEqual(self.packet.verify()["verification"], "pass")

    def test_rejects_backing_without_aperture_coverage(self) -> None:
        self.packet.rebind_role("backing", "universal-backing-v1")
        self.assert_invalid("cover at least 85%")

    def test_rejects_frame_without_edge_registration(self) -> None:
        self.packet.rebind_role("rarity-frame", "rarity-frame-f-v1")
        self.assert_invalid("six edge bands|frame coverage")

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

    def test_candidate_rejects_concerns(self) -> None:
        findings = self.packet.result["findings"]
        assert isinstance(findings, list)
        findings.append(
            {
                "category": "manifest-fidelity",
                "evaluator": "producer",
                "outcome": "concern",
                "observation": "A secondary flourish may be too prominent.",
            }
        )
        self.packet.rewrite_result()
        self.assert_invalid("clean|concern")

    def test_candidate_allows_unrelated_role_inapplicable_finding(self) -> None:
        findings = self.packet.result["findings"]
        assert isinstance(findings, list)
        findings.append(
            {
                "category": "registration",
                "evaluator": "producer",
                "outcome": "not-applicable",
                "observation": "Frame-edge registration does not apply to individual art.",
            }
        )
        self.packet.rewrite_result()
        self.assertEqual(self.packet.verify()["status"], "candidate")

    def test_revise_with_retained_image_requires_96_pixel_finding(self) -> None:
        self.packet.result["status"] = "revise"
        self.packet.result["findings"] = [
            {
                "category": "geometry",
                "evaluator": "automated",
                "outcome": "concern",
                "observation": "The effect approaches the safe-zone edge.",
            }
        ]
        self.packet.rewrite_result()
        self.assert_invalid("96-pixel inspection")

    def test_accepts_revise_with_both_view_findings_and_concern(self) -> None:
        self.packet.result["status"] = "revise"
        self.packet.result["findings"] = [
            {
                "category": "geometry",
                "evaluator": "automated",
                "outcome": "pass",
                "observation": "Role-aware geometry inspection passed.",
            },
            {
                "category": "recognition",
                "evaluator": "producer",
                "outcome": "concern",
                "observation": "The silhouette is weak at 96 pixels.",
            },
        ]
        self.packet.rewrite_result()
        self.assertEqual(self.packet.verify()["status"], "revise")

    def test_persists_and_verifies_provider_and_malformed_result_only_failures(self) -> None:
        self.packet.candidate_file.unlink()
        self.packet.result_file.unlink()
        report = persist_failed_result(
            self.packet.target,
            self.packet.assignment,
            self.packet.root,
            attempt_count=1,
            failure_kind="provider-failure",
            failure_message="The provider returned no image bytes.",
            contract_root=REPOSITORY_ROOT,
        )
        retained = load_json(self.packet.root / RESULT_PATH)
        self.assertEqual(report["verification"], "pass")
        self.assertEqual(retained["status"], "failed")
        self.assertIsNone(retained["output"])
        self.assertEqual(retained["writtenOutputPaths"], [RESULT_PATH])
        self.assertFalse(self.packet.candidate_file.exists())
        (self.packet.root / RESULT_PATH).unlink()
        second_report = persist_failed_result(
            self.packet.target,
            self.packet.assignment,
            self.packet.root,
            attempt_count=1,
            failure_kind="malformed-output",
            failure_message="The provider returned undecodable image bytes.",
            contract_root=REPOSITORY_ROOT,
        )
        second = load_json(self.packet.root / RESULT_PATH)
        self.assertEqual(second_report["verification"], "pass")
        self.assertEqual(second["failureReason"]["kind"], "malformed-output")

    def test_result_only_failure_refuses_collision(self) -> None:
        self.packet.candidate_file.unlink()
        with self.assertRaisesRegex(ValueError, "pre-existing output collision"):
            persist_failed_result(
                self.packet.target,
                self.packet.assignment,
                self.packet.root,
                attempt_count=1,
                failure_kind="malformed-output",
                failure_message="The provider returned undecodable bytes.",
                contract_root=REPOSITORY_ROOT,
            )

    def test_failed_result_cannot_coexist_with_candidate_bytes(self) -> None:
        self.packet.result.update(
            {
                "status": "failed",
                "output": None,
                "findings": [
                    {
                        "category": "other",
                        "evaluator": "producer",
                        "outcome": "fail",
                        "observation": "Provider failure.",
                    }
                ],
                "failureReason": {
                    "kind": "provider-failure",
                    "message": "Provider failure.",
                },
                "writtenOutputPaths": [RESULT_PATH],
            }
        )
        self.packet.rewrite_result()
        self.assert_invalid("claims no output but a candidate exists")

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
