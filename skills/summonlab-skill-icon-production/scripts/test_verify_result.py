#!/usr/bin/env python3
"""Adversarial tests for the one-icon production packet and result verifiers."""

from __future__ import annotations

import hashlib
import json
import os
import signal
import struct
import subprocess
import sys
import tempfile
import time
import unittest
import zlib
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))

import verify_result as verify_result_module  # noqa: E402
from validate_target import (  # noqa: E402
    GEOMETRY_GUIDE_V2_HASH,
    GEOMETRY_GUIDE_V2_PATH,
    GEOMETRY_GUIDE_V2_PURPOSE,
    GEOMETRY_V2_HASH,
    GEOMETRY_V2_PATH,
    load_json,
    read_stable_regular_file_snapshot,
    validate,
)
from verify_result import GEOMETRY_PATH, persist_failed_result, verify  # noqa: E402


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
STARTED_AT = "2026-09-01T17:01:00.000Z"
COMPLETED_AT = "2026-09-01T17:04:00.000Z"
TOTAL_WALL_TIME_MS = 180000
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
            data = (
                (REPOSITORY_ROOT / GEOMETRY_REFERENCE_PATH).read_bytes()
                if reference_path == GEOMETRY_REFERENCE_PATH
                else f"reference-{index}".encode()
            )
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
        geometry_source = (
            REPOSITORY_ROOT / "assets/wiki/skills/icon-production-v1/geometry.json"
        ).read_bytes()
        geometry_path = self.root / "assets/wiki/skills/icon-production-v1/geometry.json"
        geometry_path.parent.mkdir(parents=True, exist_ok=True)
        geometry_path.write_bytes(geometry_source)
        geometry_v2_source = (REPOSITORY_ROOT / GEOMETRY_V2_PATH).read_bytes()
        geometry_v2_path = self.root / GEOMETRY_V2_PATH
        geometry_v2_path.write_bytes(geometry_v2_source)
        guide_v2_source = (REPOSITORY_ROOT / GEOMETRY_GUIDE_V2_PATH).read_bytes()
        guide_v2_path = self.root / GEOMETRY_GUIDE_V2_PATH
        guide_v2_path.write_bytes(guide_v2_source)
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

    def verify(
        self, *, attempt_count: int = 1, bind_input_paths: bool = False
    ) -> dict[str, object]:
        return verify(
            self.target,
            self.assignment,
            self.result,
            self.result_file,
            self.root,
            attempt_count=attempt_count,
            contract_root=REPOSITORY_ROOT,
            target_path=self.target_file if bind_input_paths else None,
            assignment_path=self.assignment_file if bind_input_paths else None,
        )


class SkillIconVerifierTests(unittest.TestCase):
    def setUp(self) -> None:
        self.packet = Packet()

    def tearDown(self) -> None:
        self.packet.close()

    def assert_invalid(self, pattern: str) -> None:
        with self.assertRaisesRegex(ValueError, pattern):
            self.packet.verify()

    def persist_failure(self) -> dict[str, object]:
        return persist_failed_result(
            self.packet.target,
            self.packet.assignment,
            self.packet.root,
            attempt_count=1,
            failure_kind="provider-failure",
            failure_message="The provider returned no image bytes.",
            started_at=STARTED_AT,
            completed_at=COMPLETED_AT,
            total_wall_time_ms=TOTAL_WALL_TIME_MS,
            contract_root=REPOSITORY_ROOT,
            target_path=self.packet.target_file,
            assignment_path=self.packet.assignment_file,
        )

    def failed_result_stage(self) -> Path:
        return self.packet.result_file.with_name(
            f".{self.packet.result_file.name}.failed-result-stage"
        )

    def failed_result_owner(self) -> Path:
        return self.packet.result_file.with_name(
            f".{self.packet.result_file.name}.failed-result-owner.json"
        )

    def supersession_intent(self) -> Path:
        return self.packet.result_file.with_name(
            f".{self.packet.result_file.name}.skill-icon-supersession-intent.json"
        )

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

    def test_negated_authority_purpose_cannot_spoof_exact_literal(self) -> None:
        references = self.packet.target["references"]
        assert isinstance(references, list)
        references[0]["purpose"] = "Not the global Painted Emblem style authority."
        with self.assertRaisesRegex(ValueError, "exact canonical purpose"):
            self.packet.verify()

    def test_authority_purpose_variant_is_rejected(self) -> None:
        references = self.packet.target["references"]
        assert isinstance(references, list)
        references[0]["purpose"] = "Global Painted Emblem style authority"
        with self.assertRaisesRegex(ValueError, "exact canonical purpose"):
            self.packet.verify()

    def test_negated_calibration_purpose_is_rejected(self) -> None:
        references = self.packet.target["references"]
        assert isinstance(references, list)
        references[2]["purpose"] = "Not an approved motif-family calibration plate."
        with self.assertRaisesRegex(ValueError, "exact canonical purpose"):
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

    def test_rejects_mixed_v1_v2_protocol_tuple(self) -> None:
        self.packet.assignment["schemaVersion"] = "skill-icon-assignment-v2"
        self.packet.assignment["skillVersion"] = "summonlab-skill-icon-production-v2"
        self.packet.assignment["logicalIdentity"] = "martial-blade-horizontal-slash"
        self.packet.assignment["revision"] = 2
        self.packet.assignment["normalization"] = {
            "profile": "skill-icon-green-key-role-mask-v1"
        }
        with self.assertRaisesRegex(ValueError, "contract validation failed|protocol tuple"):
            validate(
                self.packet.target,
                self.packet.assignment,
                self.packet.root,
                allow_existing_outputs=True,
                contract_root=REPOSITORY_ROOT,
            )

    def test_producer_preflight_rejects_every_reprocess_packet_schema(self) -> None:
        for packet_name, schema_version in (
            ("target", "skill-icon-reprocess-target-v1"),
            ("assignment", "skill-icon-reprocess-assignment-v1"),
        ):
            with self.subTest(packet=packet_name):
                retained = getattr(self.packet, packet_name)["schemaVersion"]
                getattr(self.packet, packet_name)["schemaVersion"] = schema_version
                with self.assertRaisesRegex(ValueError, "coordinator-only reprocess"):
                    validate(
                        self.packet.target,
                        self.packet.assignment,
                        self.packet.root,
                        allow_existing_outputs=True,
                        contract_root=REPOSITORY_ROOT,
                    )
                getattr(self.packet, packet_name)["schemaVersion"] = retained

    def test_producer_verifier_rejects_reprocess_result_schema(self) -> None:
        self.packet.result["schemaVersion"] = "skill-icon-reprocess-result-v1"
        with self.assertRaisesRegex(ValueError, "coordinator-only reprocess"):
            self.packet.verify()

    def test_producer_rejects_reprocess_execution_namespace(self) -> None:
        self.packet.target["schemaVersion"] = "skill-icon-reprocess-execution-v1"
        with self.assertRaisesRegex(ValueError, "coordinator-only reprocess"):
            validate(
                self.packet.target,
                self.packet.assignment,
                self.packet.root,
                allow_existing_outputs=True,
                contract_root=REPOSITORY_ROOT,
            )

    def test_profile_v2_rejects_profile_v1_producer_skill_version(self) -> None:
        self._prepare_v2_result_only_failure()
        target_normalization = self.packet.target["normalization"]
        assignment_normalization = self.packet.assignment["normalization"]
        assert isinstance(target_normalization, dict)
        assert isinstance(assignment_normalization, dict)
        target_normalization["profile"] = "skill-icon-green-key-role-mask-v2"
        assignment_normalization["profile"] = "skill-icon-green-key-role-mask-v2"
        with self.assertRaisesRegex(
            ValueError, "contract validation failed|skill version"
        ):
            validate(
                self.packet.target,
                self.packet.assignment,
                self.packet.root,
                allow_existing_outputs=True,
                contract_root=REPOSITORY_ROOT,
            )

    def test_profile_v3_accepts_skill_v4_geometry_v2_and_exact_guide(self) -> None:
        self._prepare_v2_result_only_failure(
            profile="skill-icon-green-key-role-mask-v3",
            skill_version="summonlab-skill-icon-production-v4",
            geometry_path=GEOMETRY_V2_PATH,
            include_v2_guide=True,
        )
        normalization = self.packet.result["normalization"]
        assert isinstance(normalization, dict)
        self.assertEqual(normalization["profile"], "skill-icon-green-key-role-mask-v3")
        self.assertEqual(normalization["geometryHash"], GEOMETRY_V2_HASH)
        self.assertIsNone(normalization["decoderInputContentHash"])
        self.assertIsNone(normalization["containerBox"])
        self.assertIsNone(normalization["colorSpaceDisposition"])

    def test_profile_v3_rejects_profile_v2_producer_skill_version(self) -> None:
        self._prepare_v2_result_only_failure(
            profile="skill-icon-green-key-role-mask-v3",
            skill_version="summonlab-skill-icon-production-v3",
            geometry_path=GEOMETRY_V2_PATH,
            include_v2_guide=True,
            persist_result=False,
        )
        with self.assertRaisesRegex(ValueError, "contract validation failed|skill version"):
            validate(
                self.packet.target,
                self.packet.assignment,
                self.packet.root,
                contract_root=REPOSITORY_ROOT,
            )

    def test_profile_v2_rejects_profile_v3_producer_skill_version(self) -> None:
        self._prepare_v2_result_only_failure(
            profile="skill-icon-green-key-role-mask-v2",
            skill_version="summonlab-skill-icon-production-v4",
            persist_result=False,
        )
        with self.assertRaisesRegex(ValueError, "contract validation failed|skill version"):
            validate(
                self.packet.target,
                self.packet.assignment,
                self.packet.root,
                contract_root=REPOSITORY_ROOT,
            )

    def test_profile_v3_rejects_legacy_geometry_authority(self) -> None:
        self._prepare_v2_result_only_failure(
            profile="skill-icon-green-key-role-mask-v3",
            skill_version="summonlab-skill-icon-production-v4",
            include_v2_guide=True,
            persist_result=False,
        )
        with self.assertRaisesRegex(ValueError, "contract validation failed|geometry authority"):
            validate(
                self.packet.target,
                self.packet.assignment,
                self.packet.root,
                contract_root=REPOSITORY_ROOT,
            )

    def test_profile_v2_rejects_geometry_v2_authority(self) -> None:
        self._prepare_v2_result_only_failure(
            profile="skill-icon-green-key-role-mask-v2",
            skill_version="summonlab-skill-icon-production-v3",
            geometry_path=GEOMETRY_V2_PATH,
            persist_result=False,
        )
        with self.assertRaisesRegex(ValueError, "contract validation failed|geometry authority"):
            validate(
                self.packet.target,
                self.packet.assignment,
                self.packet.root,
                contract_root=REPOSITORY_ROOT,
            )

    def test_profile_v3_rejects_missing_or_mispurposed_guide(self) -> None:
        self._prepare_v2_result_only_failure(
            profile="skill-icon-green-key-role-mask-v3",
            skill_version="summonlab-skill-icon-production-v4",
            geometry_path=GEOMETRY_V2_PATH,
            include_v2_guide=True,
            persist_result=False,
        )
        references = self.packet.target["references"]
        assert isinstance(references, list)
        guide = next(
            item for item in references if item.get("path") == GEOMETRY_GUIDE_V2_PATH
        )
        for mutation in ("missing", "mispurposed", "wrong-hash"):
            with self.subTest(mutation=mutation):
                retained = list(references)
                if mutation == "missing":
                    references.remove(guide)
                elif mutation == "mispurposed":
                    guide["purpose"] = "Geometry guide for registration and safe zones."
                else:
                    guide["contentHash"] = HASH
                with self.assertRaisesRegex(ValueError, "contract validation failed|geometry guide"):
                    validate(
                        self.packet.target,
                        self.packet.assignment,
                        self.packet.root,
                        contract_root=REPOSITORY_ROOT,
                    )
                references[:] = retained
                guide["purpose"] = GEOMETRY_GUIDE_V2_PURPOSE
                guide["contentHash"] = GEOMETRY_GUIDE_V2_HASH

    def test_geometry_role_mask_accepts_only_skill_v5_geometry_v2_and_exact_guide(
        self,
    ) -> None:
        profile = "skill-icon-geometry-role-mask-v1"
        self._prepare_v2_result_only_failure(
            profile=profile,
            skill_version="summonlab-skill-icon-production-v5",
            geometry_path=GEOMETRY_V2_PATH,
            include_v2_guide=True,
        )
        normalization = self.packet.result["normalization"]
        assert isinstance(normalization, dict)
        self.assertEqual(normalization["profile"], profile)
        self.assertEqual(normalization["geometryHash"], GEOMETRY_V2_HASH)
        self.assertIsNone(normalization["decoderInputContentHash"])
        self.assertIsNone(normalization["containerBox"])
        self.assertIsNone(normalization["colorSpaceDisposition"])

        for skill_version in (
            "summonlab-skill-icon-production-v2",
            "summonlab-skill-icon-production-v3",
            "summonlab-skill-icon-production-v4",
            "summonlab-skill-icon-production-v6",
        ):
            with self.subTest(skill_version=skill_version):
                self.packet.assignment["skillVersion"] = skill_version
                with self.assertRaisesRegex(
                    ValueError, "contract validation failed|skill version"
                ):
                    validate(
                        self.packet.target,
                        self.packet.assignment,
                        self.packet.root,
                        contract_root=REPOSITORY_ROOT,
                    )
        self.packet.assignment["skillVersion"] = "summonlab-skill-icon-production-v5"

        references = self.packet.target["references"]
        assert isinstance(references, list)
        guide = next(
            item for item in references if item.get("path") == GEOMETRY_GUIDE_V2_PATH
        )
        references.remove(guide)
        with self.assertRaisesRegex(
            ValueError, "contract validation failed|geometry guide"
        ):
            validate(
                self.packet.target,
                self.packet.assignment,
                self.packet.root,
                contract_root=REPOSITORY_ROOT,
            )

    def test_strict_geometry_role_mask_accepts_only_skill_v6_geometry_v2_and_exact_guide(
        self,
    ) -> None:
        profile = "skill-icon-geometry-role-mask-v2"
        self._prepare_v2_result_only_failure(
            profile=profile,
            skill_version="summonlab-skill-icon-production-v6",
            geometry_path=GEOMETRY_V2_PATH,
            include_v2_guide=True,
        )
        normalization = self.packet.result["normalization"]
        assert isinstance(normalization, dict)
        self.assertEqual(normalization["profile"], profile)
        self.assertEqual(normalization["geometryHash"], GEOMETRY_V2_HASH)
        self.assertIsNone(normalization["decoderInputContentHash"])
        self.assertIsNone(normalization["containerBox"])
        self.assertIsNone(normalization["colorSpaceDisposition"])

        for skill_version in (
            "summonlab-skill-icon-production-v2",
            "summonlab-skill-icon-production-v3",
            "summonlab-skill-icon-production-v4",
            "summonlab-skill-icon-production-v5",
        ):
            with self.subTest(skill_version=skill_version):
                self.packet.assignment["skillVersion"] = skill_version
                with self.assertRaisesRegex(
                    ValueError, "contract validation failed|skill version"
                ):
                    validate(
                        self.packet.target,
                        self.packet.assignment,
                        self.packet.root,
                        contract_root=REPOSITORY_ROOT,
                    )

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

    def test_stable_reader_rejects_same_byte_path_swap_during_read(self) -> None:
        source = self.packet.root / "stable-reader-source.bin"
        source.write_bytes(b"stable source bytes")
        displaced = source.with_suffix(".old")

        def swap_path() -> None:
            source.rename(displaced)
            source.write_bytes(b"stable source bytes")

        with self.assertRaisesRegex(ValueError, "changed while it was being read"):
            read_stable_regular_file_snapshot(source, _after_open=swap_path)

    def test_stable_reader_rejects_fifo_replacement_without_blocking(self) -> None:
        source = self.packet.root / "stable-reader-source.bin"
        source.write_bytes(b"original regular file")
        source.rename(source.with_suffix(".displaced"))
        os.mkfifo(source)

        started = time.monotonic()
        with self.assertRaisesRegex(ValueError, "must be a regular file"):
            read_stable_regular_file_snapshot(source)
        self.assertLess(time.monotonic() - started, 1.0)

    def test_rejects_assignment_file_symlink(self) -> None:
        real_assignment = self.packet.assignment_file.with_suffix(".real.json")
        self.packet.assignment_file.rename(real_assignment)
        self.packet.assignment_file.symlink_to(real_assignment)
        with self.assertRaisesRegex(ValueError, "symbolic link|Too many levels"):
            validate(
                self.packet.target,
                self.packet.assignment,
                self.packet.root,
                target_path=self.packet.target_file,
                assignment_path=self.packet.assignment_file,
                allow_existing_outputs=True,
                contract_root=REPOSITORY_ROOT,
            )

    def test_rejects_candidate_symlink(self) -> None:
        real_candidate = self.packet.candidate_file.with_suffix(".real.png")
        self.packet.candidate_file.rename(real_candidate)
        self.packet.candidate_file.symlink_to(real_candidate)
        self.assert_invalid("symbolic link")

    def test_rejects_candidate_mutation_after_stable_inspection(self) -> None:
        original_inspector = verify_result_module.run_asset_inspection

        def mutate_after_capture(*args: object, **kwargs: object) -> dict[str, object]:
            report = original_inspector(*args, **kwargs)
            replacement = bytearray(self.packet.candidate_bytes)
            replacement[-1] ^= 1
            self.packet.candidate_file.write_bytes(replacement)
            return report

        with patch.object(
            verify_result_module,
            "run_asset_inspection",
            side_effect=mutate_after_capture,
        ):
            self.assert_invalid("retained candidate changed before verification completed")

    def test_rejects_same_byte_candidate_path_swap_after_capture(self) -> None:
        original_inspector = verify_result_module.run_asset_inspection

        def swap_after_capture(*args: object, **kwargs: object) -> dict[str, object]:
            displaced = self.packet.candidate_file.with_suffix(".displaced.png")
            self.packet.candidate_file.rename(displaced)
            self.packet.candidate_file.write_bytes(self.packet.candidate_bytes)
            displaced.unlink()
            return original_inspector(*args, **kwargs)

        with patch.object(
            verify_result_module,
            "run_asset_inspection",
            side_effect=swap_after_capture,
        ):
            self.assert_invalid("retained candidate changed before verification completed")

    def test_rejects_same_byte_target_path_swap_late_in_verification(self) -> None:
        self._assert_late_authority_path_swap(
            self.packet.target_file, "target", bind_input_paths=True
        )

    def test_rejects_same_byte_assignment_path_swap_late_in_verification(self) -> None:
        self._assert_late_authority_path_swap(
            self.packet.assignment_file, "assignment", bind_input_paths=True
        )

    def test_rejects_same_byte_reference_path_swap_late_in_verification(self) -> None:
        self._assert_late_authority_path_swap(
            self.packet.root / self.packet.reference_paths[0], "reference"
        )

    def test_rejects_same_byte_catalog_path_swap_late_in_verification(self) -> None:
        self._assert_late_authority_path_swap(
            self.packet.catalog_file, "canonical catalog"
        )

    def test_rejects_same_byte_v2_geometry_swap_for_result_only_failure(self) -> None:
        self._prepare_v2_result_only_failure()
        self._assert_late_authority_path_swap(
            self.packet.root / GEOMETRY_PATH,
            "v2 normalization geometry authority",
            bind_input_paths=True,
        )

    def test_rejects_same_byte_profile_v3_geometry_swap(self) -> None:
        self._prepare_v2_result_only_failure(
            profile="skill-icon-green-key-role-mask-v3",
            skill_version="summonlab-skill-icon-production-v4",
            geometry_path=GEOMETRY_V2_PATH,
            include_v2_guide=True,
        )
        self._assert_late_authority_path_swap(
            self.packet.root / GEOMETRY_V2_PATH,
            "v2 normalization geometry authority",
            bind_input_paths=True,
        )

    def test_rejects_same_byte_profile_v3_guide_swap(self) -> None:
        self._prepare_v2_result_only_failure(
            profile="skill-icon-green-key-role-mask-v3",
            skill_version="summonlab-skill-icon-production-v4",
            geometry_path=GEOMETRY_V2_PATH,
            include_v2_guide=True,
        )
        self._assert_late_authority_path_swap(
            self.packet.root / GEOMETRY_GUIDE_V2_PATH,
            "reference",
            bind_input_paths=True,
        )

    def _assert_late_authority_path_swap(
        self, path: Path, label: str, *, bind_input_paths: bool = False
    ) -> None:
        original_contract_validation = verify_result_module.run_contract_validation
        swapped = False

        def swap_after_execution(*args: object, **kwargs: object) -> None:
            nonlocal swapped
            original_contract_validation(*args, **kwargs)
            if not swapped and args and args[0] == "execution":
                retained = path.read_bytes()
                displaced = path.with_name(path.name + ".displaced")
                path.rename(displaced)
                path.write_bytes(retained)
                displaced.unlink()
                swapped = True

        with patch.object(
            verify_result_module,
            "run_contract_validation",
            side_effect=swap_after_execution,
        ):
            with self.assertRaisesRegex(
                ValueError, rf"{label}.*changed before verification completed"
            ):
                self.packet.verify(bind_input_paths=bind_input_paths)

    def _prepare_v2_result_only_failure(
        self,
        *,
        profile: str = "skill-icon-green-key-role-mask-v1",
        skill_version: str = "summonlab-skill-icon-production-v2",
        geometry_path: str = GEOMETRY_PATH,
        include_v2_guide: bool = False,
        persist_result: bool = True,
    ) -> None:
        job_id = "charcoal-forged-stone-v2"
        self.packet.rebind_role("backing", job_id)
        self.packet.candidate_file.unlink()
        self.packet.result_file.unlink()
        self.packet.target_file.unlink()
        self.packet.assignment_file.unlink()
        exact_prompt = (
            "Paint the backing over an opaque #00FF00 matte with no baked checkerboard."
        )
        geometry_hash = hashlib.sha256(
            (self.packet.root / geometry_path).read_bytes()
        ).hexdigest()
        references = self.packet.target["references"]
        assert isinstance(references, list)
        if include_v2_guide:
            references.append(
                {
                    "path": GEOMETRY_GUIDE_V2_PATH,
                    "purpose": GEOMETRY_GUIDE_V2_PURPOSE,
                    "contentHash": GEOMETRY_GUIDE_V2_HASH,
                }
            )
        self.packet.target.update(
            {
                "schemaVersion": "skill-icon-target-v2",
                "logicalIdentity": "charcoal-forged-stone",
                "revision": 2,
                "exactPrompt": exact_prompt,
                "normalization": {
                    "profile": profile,
                    "sourceContract": {
                        "mediaType": "image/png",
                        "width": 1254,
                        "height": 1254,
                        "alphaMode": "rgb",
                        "matteColor": "#00FF00",
                    },
                    "outputContract": {
                        "mediaType": "image/png",
                        "width": 1024,
                        "height": 1024,
                        "alphaMode": "rgba",
                    },
                    "geometry": {
                        "path": geometry_path,
                        "contentHash": geometry_hash,
                    },
                },
            }
        )
        self.packet.assignment.update(
            {
                "schemaVersion": "skill-icon-assignment-v2",
                "logicalIdentity": "charcoal-forged-stone",
                "revision": 2,
                "skillVersion": skill_version,
                "normalization": {"profile": profile},
            }
        )
        target_path = self.packet.assignment["targetPath"]
        assignment_path = self.packet.assignment["assignmentPath"]
        assert isinstance(target_path, str)
        assert isinstance(assignment_path, str)
        self.packet.target_file = write_json(
            self.packet.root, target_path, self.packet.target
        )
        self.packet.assignment_file = write_json(
            self.packet.root, assignment_path, self.packet.assignment
        )
        subprocess.run(["git", "add", "-A"], cwd=self.packet.root, check=True)
        subprocess.run(
            ["git", "commit", "-qm", "v2 result-only fixture"],
            cwd=self.packet.root,
            check=True,
        )
        if persist_result:
            persist_failed_result(
                self.packet.target,
                self.packet.assignment,
                self.packet.root,
                attempt_count=1,
                failure_kind="provider-failure",
                failure_message="The provider returned no image bytes.",
                started_at=STARTED_AT,
                completed_at=COMPLETED_AT,
                total_wall_time_ms=TOTAL_WALL_TIME_MS,
                contract_root=REPOSITORY_ROOT,
                target_path=self.packet.target_file,
                assignment_path=self.packet.assignment_file,
            )
            self.packet.result_file = self.packet.root / self.packet.target["output"][
                "resultPath"
            ]
            self.packet.result = load_json(self.packet.result_file)

    def _prepare_superseded_packet(
        self,
        *,
        higher_profile: str = "skill-icon-green-key-role-mask-v2",
        higher_skill_version: str = "summonlab-skill-icon-production-v3",
    ) -> Path:
        for path in (
            self.packet.candidate_file,
            self.packet.result_file,
            self.packet.target_file,
            self.packet.assignment_file,
        ):
            if path.exists() or path.is_symlink():
                path.unlink()
        logical_identity = "charcoal-forged-stone"
        old_job = f"{logical_identity}-v2"
        new_job = f"{logical_identity}-v3"
        geometry_hash = hashlib.sha256(
            (self.packet.root / GEOMETRY_PATH).read_bytes()
        ).hexdigest()
        references = self.packet.target["references"]
        assert isinstance(references, list)
        if higher_profile in {
            "skill-icon-green-key-role-mask-v3",
            "skill-icon-geometry-role-mask-v1",
            "skill-icon-geometry-role-mask-v2",
        }:
            references.append(
                {
                    "path": GEOMETRY_GUIDE_V2_PATH,
                    "purpose": GEOMETRY_GUIDE_V2_PURPOSE,
                    "contentHash": GEOMETRY_GUIDE_V2_HASH,
                }
            )
        exact_prompt = (
            "Paint one charcoal forged-stone backing over an opaque #00FF00 matte "
            "with no baked checkerboard."
        )

        def paths(job_id: str) -> dict[str, str]:
            root = "assets/wiki/skills/icon-production-v1"
            return {
                "target": f"{root}/targets/references/{job_id}.json",
                "assignment": f"{root}/assignments/references/{job_id}.json",
                "candidate": f"{root}/candidates/references/{job_id}.png",
                "result": f"{root}/results/references/{job_id}.json",
            }

        def normalization(profile: str) -> dict[str, object]:
            profile_geometry_path = (
                GEOMETRY_V2_PATH
                if profile
                in {
                    "skill-icon-green-key-role-mask-v3",
                    "skill-icon-geometry-role-mask-v1",
                    "skill-icon-geometry-role-mask-v2",
                }
                else GEOMETRY_PATH
            )
            profile_geometry_hash = hashlib.sha256(
                (self.packet.root / profile_geometry_path).read_bytes()
            ).hexdigest()
            return {
                "profile": profile,
                "sourceContract": {
                    "mediaType": "image/png",
                    "width": 1254,
                    "height": 1254,
                    "alphaMode": "rgb",
                    "matteColor": "#00FF00",
                },
                "outputContract": {
                    "mediaType": "image/png",
                    "width": 1024,
                    "height": 1024,
                    "alphaMode": "rgba",
                },
                "geometry": {
                    "path": profile_geometry_path,
                    "contentHash": profile_geometry_hash,
                },
            }

        def target(job_id: str, revision: int, profile: str) -> dict[str, object]:
            packet_paths = paths(job_id)
            return {
                "schemaVersion": "skill-icon-target-v2",
                "jobId": job_id,
                "logicalIdentity": logical_identity,
                "revision": revision,
                "role": "backing",
                "skillTargetId": None,
                "motifFamily": None,
                "rarity": None,
                "exactPrompt": exact_prompt,
                "references": references,
                "canvas": {"width": 1024, "height": 1024, "mediaType": "image/png"},
                "output": {
                    "candidatePath": packet_paths["candidate"],
                    "resultPath": packet_paths["result"],
                },
                "normalization": normalization(profile),
            }

        def assignment(
            job_id: str, revision: int, profile: str, skill_version: str
        ) -> dict[str, object]:
            packet_paths = paths(job_id)
            return {
                "schemaVersion": "skill-icon-assignment-v2",
                "assignmentId": f"assignment-{job_id}",
                "jobId": job_id,
                "logicalIdentity": logical_identity,
                "revision": revision,
                "targetPath": packet_paths["target"],
                "assignmentPath": packet_paths["assignment"],
                "skillVersion": skill_version,
                "normalization": {"profile": profile},
                "assignedAt": "2026-09-02T12:00:00.000Z",
                "retryCeiling": 1,
                "permittedOutputs": {
                    "candidatePath": packet_paths["candidate"],
                    "resultPath": packet_paths["result"],
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

        old_paths = paths(old_job)
        new_paths = paths(new_job)
        old_target = target(old_job, 2, "skill-icon-green-key-role-mask-v1")
        old_assignment = assignment(
            old_job,
            2,
            "skill-icon-green-key-role-mask-v1",
            "summonlab-skill-icon-production-v2",
        )
        new_target = target(new_job, 3, higher_profile)
        new_assignment = assignment(
            new_job,
            3,
            higher_profile,
            higher_skill_version,
        )
        old_target_file = write_json(self.packet.root, old_paths["target"], old_target)
        old_assignment_file = write_json(
            self.packet.root, old_paths["assignment"], old_assignment
        )
        new_target_file = write_json(self.packet.root, new_paths["target"], new_target)
        new_assignment_file = write_json(
            self.packet.root, new_paths["assignment"], new_assignment
        )
        subprocess.run(["git", "add", "-A"], cwd=self.packet.root, check=True)
        subprocess.run(
            ["git", "commit", "-qm", "supersession fixture"],
            cwd=self.packet.root,
            check=True,
        )
        timestamp = "2026-09-02T12:01:00.000Z"
        result = {
            "schemaVersion": "skill-icon-result-v2",
            "resultId": f"result-{old_job}",
            "jobId": old_job,
            "logicalIdentity": logical_identity,
            "revision": 2,
            "role": "backing",
            "assignmentId": f"assignment-{old_job}",
            "status": "superseded",
            "attemptCount": 0,
            "supersessionReason": (
                "unattempted-packet-superseded-by-higher-revision"
            ),
            "supersedingAuthority": {
                "targetPath": new_paths["target"],
                "targetContentHash": hashlib.sha256(new_target_file.read_bytes()).hexdigest(),
                "assignmentPath": new_paths["assignment"],
                "assignmentContentHash": hashlib.sha256(
                    new_assignment_file.read_bytes()
                ).hexdigest(),
                "jobId": new_job,
                "logicalIdentity": logical_identity,
                "revision": 3,
                "role": "backing",
            },
            "exactPrompt": exact_prompt,
            "promptHash": hashlib.sha256(exact_prompt.encode()).hexdigest(),
            "referenceInputs": [
                {"path": item["path"], "contentHash": item["contentHash"]}
                for item in references
            ],
            "normalization": {
                "profile": "skill-icon-green-key-role-mask-v1",
                "outcome": "not-run",
                "geometryHash": geometry_hash,
                "providerSource": None,
                "sourceContentHash": None,
                "outputContentHash": None,
            },
            "output": None,
            "resultPath": old_paths["result"],
            "findings": [],
            "startedAt": timestamp,
            "completedAt": timestamp,
            "totalWallTimeMs": 0,
            "writtenOutputPaths": [old_paths["result"]],
            "noSharedFilesEdited": True,
            "selfPromoted": False,
        }
        self.packet.target = old_target
        self.packet.assignment = old_assignment
        self.packet.target_file = old_target_file
        self.packet.assignment_file = old_assignment_file
        self.packet.result = result
        self.packet.result_file = write_json(self.packet.root, old_paths["result"], result)
        self.packet.candidate_file = self.packet.root / old_paths["candidate"]
        return new_target_file

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

    def test_accepts_coordinator_supersession_bound_to_live_higher_revision(self) -> None:
        self._prepare_superseded_packet()
        report = self.packet.verify(attempt_count=0, bind_input_paths=True)
        self.assertEqual(report["status"], "superseded")
        self.assertEqual(report["attemptCount"], 0)
        self.assertEqual(report["writtenOutputPaths"], [self.packet.result["resultPath"]])

    def test_accepts_profile_v1_higher_superseding_authority(self) -> None:
        self._prepare_superseded_packet(
            higher_profile="skill-icon-green-key-role-mask-v1",
            higher_skill_version="summonlab-skill-icon-production-v2",
        )
        self.assertEqual(
            self.packet.verify(attempt_count=0, bind_input_paths=True)["status"],
            "superseded",
        )

    def test_accepts_profile_v3_higher_superseding_authority(self) -> None:
        self._prepare_superseded_packet(
            higher_profile="skill-icon-green-key-role-mask-v3",
            higher_skill_version="summonlab-skill-icon-production-v4",
        )
        self.assertEqual(
            self.packet.verify(attempt_count=0, bind_input_paths=True)["status"],
            "superseded",
        )

    def test_accepts_profile_v5_higher_superseding_authority(self) -> None:
        self._prepare_superseded_packet(
            higher_profile="skill-icon-geometry-role-mask-v2",
            higher_skill_version="summonlab-skill-icon-production-v6",
        )
        self.assertEqual(
            self.packet.verify(attempt_count=0, bind_input_paths=True)["status"],
            "superseded",
        )

    def test_rejects_supersession_when_higher_target_bytes_change(self) -> None:
        higher_target = self._prepare_superseded_packet()
        retained = load_json(higher_target)
        retained["exactPrompt"] = str(retained["exactPrompt"]) + " Changed."
        higher_target.write_text(json.dumps(retained, indent=2) + "\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "hash does not match|changed"):
            self.packet.verify(attempt_count=0, bind_input_paths=True)

    def test_rejects_semantic_equal_superseding_target_rewrite_between_reads(self) -> None:
        higher_target = self._prepare_superseded_packet()
        original_validate = verify_result_module.validate
        rewritten = False

        def rewrite_before_validation(*args: object, **kwargs: object) -> dict[str, object]:
            nonlocal rewritten
            target = args[0]
            assert isinstance(target, dict)
            if target.get("jobId") == "charcoal-forged-stone-v3" and not rewritten:
                retained = load_json(higher_target)
                higher_target.write_text(
                    json.dumps(retained, indent=4) + "\n", encoding="utf-8"
                )
                rewritten = True
            return original_validate(*args, **kwargs)

        with patch.object(
            verify_result_module, "validate", side_effect=rewrite_before_validation
        ):
            with self.assertRaisesRegex(ValueError, "raw authority.*changed"):
                self.packet.verify(attempt_count=0, bind_input_paths=True)

    def test_superseded_evidence_rejects_nonzero_provider_attempt_count(self) -> None:
        self._prepare_superseded_packet()
        with self.assertRaisesRegex(ValueError, "exactly zero provider attempts"):
            self.packet.verify(attempt_count=1, bind_input_paths=True)

    def test_producer_failure_writer_cannot_self_supersede(self) -> None:
        self.packet.candidate_file.unlink()
        self.packet.result_file.unlink()
        with self.assertRaisesRegex(ValueError, "failure kind is unsupported"):
            persist_failed_result(
                self.packet.target,
                self.packet.assignment,
                self.packet.root,
                attempt_count=1,
                failure_kind="protocol-superseded",
                failure_message="A coordinator created a newer packet.",
                started_at=STARTED_AT,
                completed_at=COMPLETED_AT,
                total_wall_time_ms=TOTAL_WALL_TIME_MS,
                contract_root=REPOSITORY_ROOT,
            )
        self.assertFalse(self.packet.result_file.exists())

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
        self.packet.rebind_role("backing", "charcoal-forged-stone-v1")
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
            started_at=STARTED_AT,
            completed_at=COMPLETED_AT,
            total_wall_time_ms=TOTAL_WALL_TIME_MS,
            contract_root=REPOSITORY_ROOT,
        )
        retained = load_json(self.packet.root / RESULT_PATH)
        self.assertEqual(report["verification"], "pass")
        self.assertEqual(retained["status"], "failed")
        self.assertIsNone(retained["output"])
        self.assertEqual(retained["writtenOutputPaths"], [RESULT_PATH])
        self.assertEqual(retained["startedAt"], STARTED_AT)
        self.assertEqual(retained["completedAt"], COMPLETED_AT)
        self.assertEqual(retained["totalWallTimeMs"], TOTAL_WALL_TIME_MS)
        self.assertFalse(self.packet.candidate_file.exists())
        (self.packet.root / RESULT_PATH).unlink()
        second_report = persist_failed_result(
            self.packet.target,
            self.packet.assignment,
            self.packet.root,
            attempt_count=1,
            failure_kind="malformed-output",
            failure_message="The provider returned undecodable image bytes.",
            started_at=STARTED_AT,
            completed_at=COMPLETED_AT,
            total_wall_time_ms=TOTAL_WALL_TIME_MS,
            contract_root=REPOSITORY_ROOT,
        )
        second = load_json(self.packet.root / RESULT_PATH)
        self.assertEqual(second_report["verification"], "pass")
        self.assertEqual(second["failureReason"]["kind"], "malformed-output")

    @unittest.skipUnless(hasattr(os, "fork"), "requires POSIX fork and SIGKILL")
    def test_sigkill_mid_stage_write_leaves_no_path_and_retry_succeeds(self) -> None:
        self.packet.candidate_file.unlink()
        self.packet.result_file.unlink()
        child = os.fork()
        if child == 0:
            def kill_during_unnamed_write(phase: str) -> None:
                if phase == "stage-write-in-progress":
                    os.kill(os.getpid(), signal.SIGKILL)

            with patch.object(
                verify_result_module,
                "_failed_result_transaction_checkpoint",
                side_effect=kill_during_unnamed_write,
            ):
                self.persist_failure()
            os._exit(94)

        _, wait_status = os.waitpid(child, 0)
        self.assertTrue(os.WIFSIGNALED(wait_status))
        self.assertEqual(os.WTERMSIG(wait_status), signal.SIGKILL)
        self.assertFalse(self.failed_result_owner().exists())
        self.assertFalse(self.failed_result_stage().exists())
        self.assertFalse(self.packet.result_file.exists())
        self.assertEqual(self.persist_failure()["verification"], "pass")

    @unittest.skipUnless(hasattr(os, "fork"), "requires POSIX fork and SIGKILL")
    def test_sigkill_after_owner_publish_recovers_owner_only_transaction(self) -> None:
        self.packet.candidate_file.unlink()
        self.packet.result_file.unlink()
        child = os.fork()
        if child == 0:
            def kill_after_owner_publish(phase: str) -> None:
                if phase == "owner-published":
                    os.kill(os.getpid(), signal.SIGKILL)

            with patch.object(
                verify_result_module,
                "_failed_result_transaction_checkpoint",
                side_effect=kill_after_owner_publish,
            ):
                self.persist_failure()
            os._exit(95)

        _, wait_status = os.waitpid(child, 0)
        self.assertTrue(os.WIFSIGNALED(wait_status))
        self.assertEqual(os.WTERMSIG(wait_status), signal.SIGKILL)
        self.assertTrue(self.failed_result_owner().is_file())
        self.assertFalse(self.failed_result_stage().exists())
        self.assertFalse(self.packet.result_file.exists())
        self.assertEqual(self.persist_failure()["verification"], "pass")
        self.assertFalse(self.failed_result_owner().exists())

    @unittest.skipUnless(hasattr(os, "fork"), "requires POSIX fork and SIGKILL")
    def test_sigkill_after_stage_publish_recovers_before_final_install(self) -> None:
        self.packet.candidate_file.unlink()
        self.packet.result_file.unlink()
        child = os.fork()
        if child == 0:
            def kill_after_stage_publish(phase: str) -> None:
                if phase == "staged":
                    os.kill(os.getpid(), signal.SIGKILL)

            with patch.object(
                verify_result_module,
                "_failed_result_transaction_checkpoint",
                side_effect=kill_after_stage_publish,
            ):
                self.persist_failure()
            os._exit(96)

        _, wait_status = os.waitpid(child, 0)
        self.assertTrue(os.WIFSIGNALED(wait_status))
        self.assertEqual(os.WTERMSIG(wait_status), signal.SIGKILL)
        self.assertTrue(self.failed_result_owner().is_file())
        self.assertTrue(self.failed_result_stage().is_file())
        self.assertFalse(self.packet.result_file.exists())
        self.assertEqual(self.persist_failure()["verification"], "pass")
        self.assertFalse(self.failed_result_owner().exists())
        self.assertFalse(self.failed_result_stage().exists())

    @unittest.skipUnless(hasattr(os, "fork"), "requires POSIX fork and SIGKILL")
    def test_dead_owner_rejects_same_byte_foreign_stage_inode(self) -> None:
        self.packet.candidate_file.unlink()
        self.packet.result_file.unlink()
        child = os.fork()
        if child == 0:
            def kill_after_stage_publish(phase: str) -> None:
                if phase == "staged":
                    os.kill(os.getpid(), signal.SIGKILL)

            with patch.object(
                verify_result_module,
                "_failed_result_transaction_checkpoint",
                side_effect=kill_after_stage_publish,
            ):
                self.persist_failure()
            os._exit(97)

        _, wait_status = os.waitpid(child, 0)
        self.assertTrue(os.WIFSIGNALED(wait_status))
        self.assertEqual(os.WTERMSIG(wait_status), signal.SIGKILL)
        stage = self.failed_result_stage()
        retained = stage.read_bytes()
        displaced = stage.with_name(stage.name + ".dead-owner-inode")
        stage.rename(displaced)
        stage.write_bytes(retained)
        displaced.unlink()
        foreign_identity = (stage.stat().st_dev, stage.stat().st_ino)
        with self.assertRaisesRegex(ValueError, "inode does not match"):
            self.persist_failure()
        self.assertEqual((stage.stat().st_dev, stage.stat().st_ino), foreign_identity)
        self.assertEqual(stage.read_bytes(), retained)
        self.assertTrue(self.failed_result_owner().is_file())
        self.assertFalse(self.packet.result_file.exists())

    @unittest.skipUnless(hasattr(os, "fork"), "requires POSIX fork")
    def test_live_owner_serializes_identical_concurrent_writers(self) -> None:
        self.packet.candidate_file.unlink()
        self.packet.result_file.unlink()
        ready_read, ready_write = os.pipe()
        release_read, release_write = os.pipe()
        child = os.fork()
        if child == 0:
            os.close(ready_read)
            os.close(release_write)

            def pause_after_owner_publish(phase: str) -> None:
                if phase == "owner-published":
                    os.write(ready_write, b"1")
                    os.read(release_read, 1)

            try:
                with patch.object(
                    verify_result_module,
                    "_failed_result_transaction_checkpoint",
                    side_effect=pause_after_owner_publish,
                ):
                    self.persist_failure()
            except Exception:
                os._exit(98)
            os._exit(0)

        os.close(ready_write)
        os.close(release_read)
        try:
            self.assertEqual(os.read(ready_read, 1), b"1")
            with self.assertRaisesRegex(ValueError, "locked by another writer|live owner"):
                self.persist_failure()
            os.write(release_write, b"1")
        finally:
            os.close(ready_read)
            os.close(release_write)
        _, wait_status = os.waitpid(child, 0)
        self.assertTrue(os.WIFEXITED(wait_status))
        self.assertEqual(os.WEXITSTATUS(wait_status), 0)
        self.assertEqual(load_json(self.packet.result_file)["status"], "failed")
        self.assertFalse(self.failed_result_owner().exists())
        self.assertFalse(self.failed_result_stage().exists())

    @unittest.skipUnless(hasattr(os, "fork"), "requires POSIX fork")
    def test_dead_owner_takeover_serializes_concurrent_recovery(self) -> None:
        self.packet.candidate_file.unlink()
        self.packet.result_file.unlink()
        crashed = os.fork()
        if crashed == 0:
            def kill_after_stage_publish(phase: str) -> None:
                if phase == "staged":
                    os.kill(os.getpid(), signal.SIGKILL)

            with patch.object(
                verify_result_module,
                "_failed_result_transaction_checkpoint",
                side_effect=kill_after_stage_publish,
            ):
                self.persist_failure()
            os._exit(100)

        _, crashed_status = os.waitpid(crashed, 0)
        self.assertTrue(os.WIFSIGNALED(crashed_status))
        self.assertTrue(self.failed_result_owner().is_file())
        self.assertTrue(self.failed_result_stage().is_file())

        ready_read, ready_write = os.pipe()
        release_read, release_write = os.pipe()
        recovering = os.fork()
        if recovering == 0:
            os.close(ready_read)
            os.close(release_write)

            def pause_after_install(phase: str) -> None:
                if phase == "installed":
                    os.write(ready_write, b"1")
                    os.read(release_read, 1)

            try:
                with patch.object(
                    verify_result_module,
                    "_failed_result_transaction_checkpoint",
                    side_effect=pause_after_install,
                ):
                    self.persist_failure()
            except Exception:
                os._exit(101)
            os._exit(0)

        os.close(ready_write)
        os.close(release_read)
        try:
            self.assertEqual(os.read(ready_read, 1), b"1")
            with self.assertRaisesRegex(ValueError, "locked by another writer"):
                self.persist_failure()
            os.write(release_write, b"1")
        finally:
            os.close(ready_read)
            os.close(release_write)
        _, recovery_status = os.waitpid(recovering, 0)
        self.assertTrue(os.WIFEXITED(recovery_status))
        self.assertEqual(os.WEXITSTATUS(recovery_status), 0)
        self.assertEqual(load_json(self.packet.result_file)["status"], "failed")
        self.assertFalse(self.failed_result_owner().exists())
        self.assertFalse(self.failed_result_stage().exists())

    @unittest.skipUnless(hasattr(os, "fork"), "requires POSIX fork and SIGKILL")
    def test_sigkill_after_atomic_install_recovers_complete_result(self) -> None:
        self.packet.candidate_file.unlink()
        self.packet.result_file.unlink()
        child = os.fork()
        if child == 0:
            def kill_at_durable_install(phase: str) -> None:
                if phase == "installed":
                    os.kill(os.getpid(), signal.SIGKILL)

            with patch.object(
                verify_result_module,
                "_failed_result_transaction_checkpoint",
                side_effect=kill_at_durable_install,
            ):
                self.persist_failure()
            os._exit(93)

        _, wait_status = os.waitpid(child, 0)
        self.assertTrue(os.WIFSIGNALED(wait_status))
        self.assertEqual(os.WTERMSIG(wait_status), signal.SIGKILL)
        stage = self.failed_result_stage()
        owner = self.failed_result_owner()
        self.assertTrue(owner.is_file())
        self.assertTrue(stage.is_file())
        self.assertTrue(self.packet.result_file.is_file())
        self.assertEqual(
            self.packet.result_file.stat().st_ino,
            stage.stat().st_ino,
        )
        # Publication cannot expose a prefix: the installed name is a hard link
        # to the already-fsynced, complete JSON payload.
        retained = load_json(self.packet.result_file)
        self.assertEqual(retained["status"], "failed")
        report = self.persist_failure()
        self.assertEqual(report["verification"], "pass")
        self.assertFalse(owner.exists())
        self.assertFalse(stage.exists())

    @unittest.skipUnless(hasattr(os, "fork"), "requires POSIX fork and SIGKILL")
    def test_sigkill_after_owner_removal_preserves_committed_final(self) -> None:
        self.packet.candidate_file.unlink()
        self.packet.result_file.unlink()
        child = os.fork()
        if child == 0:
            def kill_after_commit(phase: str) -> None:
                if phase == "committed":
                    os.kill(os.getpid(), signal.SIGKILL)

            with patch.object(
                verify_result_module,
                "_failed_result_transaction_checkpoint",
                side_effect=kill_after_commit,
            ):
                self.persist_failure()
            os._exit(99)

        _, wait_status = os.waitpid(child, 0)
        self.assertTrue(os.WIFSIGNALED(wait_status))
        self.assertEqual(os.WTERMSIG(wait_status), signal.SIGKILL)
        stage = self.failed_result_stage()
        self.assertFalse(self.failed_result_owner().exists())
        self.assertTrue(stage.is_file())
        self.assertTrue(self.packet.result_file.is_file())
        committed_bytes = self.packet.result_file.read_bytes()
        stage_identity = (stage.stat().st_dev, stage.stat().st_ino)
        with self.assertRaisesRegex(ValueError, "pre-existing output collision"):
            self.persist_failure()
        self.assertEqual(self.packet.result_file.read_bytes(), committed_bytes)
        self.assertEqual((stage.stat().st_dev, stage.stat().st_ino), stage_identity)

    def test_late_preflight_authority_swap_rolls_back_owned_result(self) -> None:
        self.packet.candidate_file.unlink()
        self.packet.result_file.unlink()
        authority = self.packet.root / self.packet.reference_paths[0]
        swapped = False

        def swap_after_install(phase: str) -> None:
            nonlocal swapped
            if phase == "installed" and not swapped:
                retained = authority.read_bytes()
                displaced = authority.with_name(authority.name + ".displaced")
                authority.rename(displaced)
                authority.write_bytes(retained)
                displaced.unlink()
                swapped = True

        with patch.object(
            verify_result_module,
            "_failed_result_transaction_checkpoint",
            side_effect=swap_after_install,
        ):
            with self.assertRaisesRegex(
                ValueError, "reference.*changed before verification completed"
            ):
                self.persist_failure()
        self.assertFalse(self.packet.result_file.exists())
        self.assertFalse(self.failed_result_owner().exists())
        self.assertFalse(self.failed_result_stage().exists())
        self.assertEqual(self.persist_failure()["verification"], "pass")

    def test_postverify_failure_rolls_back_owned_result_for_retry(self) -> None:
        self.packet.candidate_file.unlink()
        self.packet.result_file.unlink()
        with patch.object(
            verify_result_module,
            "verify",
            side_effect=ValueError("injected post-write verification failure"),
        ):
            with self.assertRaisesRegex(ValueError, "injected post-write"):
                self.persist_failure()
        self.assertFalse(self.packet.result_file.exists())
        self.assertFalse(self.failed_result_owner().exists())
        self.assertFalse(self.failed_result_stage().exists())
        self.assertEqual(self.persist_failure()["verification"], "pass")

    def test_postverify_foreign_replacement_is_never_deleted(self) -> None:
        self.packet.candidate_file.unlink()
        self.packet.result_file.unlink()
        foreign_bytes = b'{"foreign":true}\n'

        def replace_final_then_fail(
            *_args: object, **_kwargs: object
        ) -> dict[str, object]:
            displaced = self.packet.result_file.with_name(
                self.packet.result_file.name + ".owned-displaced"
            )
            self.packet.result_file.rename(displaced)
            self.packet.result_file.write_bytes(foreign_bytes)
            displaced.unlink()
            raise ValueError("injected post-write foreign replacement")

        with patch.object(
            verify_result_module,
            "verify",
            side_effect=replace_final_then_fail,
        ):
            with self.assertRaisesRegex(ValueError, "foreign replacement"):
                self.persist_failure()
        self.assertEqual(self.packet.result_file.read_bytes(), foreign_bytes)
        self.assertFalse(self.failed_result_owner().exists())
        self.assertFalse(self.failed_result_stage().exists())

    def test_foreign_transaction_stage_is_never_deleted(self) -> None:
        self.packet.candidate_file.unlink()
        self.packet.result_file.unlink()
        stage = self.failed_result_stage()
        foreign_bytes = b"foreign transaction evidence"
        stage.write_bytes(foreign_bytes)
        with self.assertRaisesRegex(ValueError, "has no owner record"):
            self.persist_failure()
        self.assertEqual(stage.read_bytes(), foreign_bytes)
        self.assertFalse(self.packet.result_file.exists())

    def test_supersession_intent_race_after_owner_publish_rolls_back_producer(self) -> None:
        self.packet.candidate_file.unlink()
        self.packet.result_file.unlink()
        intent = self.supersession_intent()
        intent_bytes = b'{"coordinator":"supersession"}\n'

        def publish_intent_after_owner(phase: str) -> None:
            if phase == "owner-published":
                intent.write_bytes(intent_bytes)

        with patch.object(
            verify_result_module,
            "_failed_result_transaction_checkpoint",
            side_effect=publish_intent_after_owner,
        ):
            with self.assertRaisesRegex(ValueError, "supersession intent"):
                self.persist_failure()
        self.assertEqual(intent.read_bytes(), intent_bytes)
        self.assertFalse(self.failed_result_owner().exists())
        self.assertFalse(self.failed_result_stage().exists())
        self.assertFalse(self.packet.result_file.exists())
        intent.unlink()
        self.assertEqual(self.persist_failure()["verification"], "pass")

    def test_supersession_intent_symlink_blocks_without_mutation(self) -> None:
        self.packet.candidate_file.unlink()
        self.packet.result_file.unlink()
        intent = self.supersession_intent()
        intent.symlink_to("foreign-intent-record.json")
        with self.assertRaisesRegex(ValueError, "supersession intent"):
            self.persist_failure()
        self.assertTrue(intent.is_symlink())
        self.assertFalse(self.failed_result_owner().exists())
        self.assertFalse(self.failed_result_stage().exists())
        self.assertFalse(self.packet.result_file.exists())

    def test_v2_failure_records_pathless_observed_normalization_source(self) -> None:
        self.packet.candidate_file.unlink()
        self.packet.result_file.unlink()
        self.packet.target_file.unlink()
        self.packet.assignment_file.unlink()
        job_id = "charcoal-forged-stone-v2"
        candidate_path = (
            "assets/wiki/skills/icon-production-v1/candidates/references/"
            f"{job_id}.png"
        )
        result_path = (
            "assets/wiki/skills/icon-production-v1/results/references/"
            f"{job_id}.json"
        )
        target_path = (
            "assets/wiki/skills/icon-production-v1/targets/references/"
            f"{job_id}.json"
        )
        assignment_path = (
            "assets/wiki/skills/icon-production-v1/assignments/references/"
            f"{job_id}.json"
        )
        geometry_hash = hashlib.sha256(
            (self.packet.root / GEOMETRY_PATH).read_bytes()
        ).hexdigest()
        exact_prompt = (
            "Paint the backing over an opaque #00FF00 matte with no baked checkerboard."
        )
        target = {
            "schemaVersion": "skill-icon-target-v2",
            "jobId": job_id,
            "logicalIdentity": "charcoal-forged-stone",
            "revision": 2,
            "role": "backing",
            "skillTargetId": None,
            "motifFamily": None,
            "rarity": None,
            "exactPrompt": exact_prompt,
            "references": self.packet.target["references"],
            "canvas": {"width": 1024, "height": 1024, "mediaType": "image/png"},
            "output": {"candidatePath": candidate_path, "resultPath": result_path},
            "normalization": {
                "profile": "skill-icon-green-key-role-mask-v2",
                "sourceContract": {
                    "mediaType": "image/png",
                    "width": 1254,
                    "height": 1254,
                    "alphaMode": "rgb",
                    "matteColor": "#00FF00",
                },
                "outputContract": {
                    "mediaType": "image/png",
                    "width": 1024,
                    "height": 1024,
                    "alphaMode": "rgba",
                },
                "geometry": {"path": GEOMETRY_PATH, "contentHash": geometry_hash},
            },
        }
        assignment = {
            **self.packet.assignment,
            "schemaVersion": "skill-icon-assignment-v2",
            "assignmentId": f"assignment-{job_id}",
            "jobId": job_id,
            "logicalIdentity": "charcoal-forged-stone",
            "revision": 2,
            "targetPath": target_path,
            "assignmentPath": assignment_path,
            "skillVersion": "summonlab-skill-icon-production-v3",
            "normalization": {"profile": "skill-icon-green-key-role-mask-v2"},
            "permittedOutputs": {
                "candidatePath": candidate_path,
                "resultPath": result_path,
            },
        }
        target_file = write_json(self.packet.root, target_path, target)
        assignment_file = write_json(self.packet.root, assignment_path, assignment)
        provider_source = self.packet.root / "provider-source.png"
        provider_bytes = png(1254, 1254, color_type=2, pattern="full")
        provider_source.write_bytes(provider_bytes)
        subprocess.run(["git", "add", "-A"], cwd=self.packet.root, check=True)
        subprocess.run(
            ["git", "commit", "-qm", "v2 fixture"], cwd=self.packet.root, check=True
        )
        report = persist_failed_result(
            target,
            assignment,
            self.packet.root,
            attempt_count=1,
            failure_kind="validation",
            failure_message="The provider image failed the green-matte gate.",
            started_at=STARTED_AT,
            completed_at=COMPLETED_AT,
            total_wall_time_ms=TOTAL_WALL_TIME_MS,
            contract_root=REPOSITORY_ROOT,
            target_path=target_file,
            assignment_path=assignment_file,
            normalization_source=provider_source,
        )
        retained = load_json(self.packet.root / result_path)
        self.assertEqual(report["verification"], "pass")
        self.assertEqual(retained["normalization"]["outcome"], "failed")
        evidence = retained["normalization"]["providerSource"]
        self.assertNotIn("path", evidence)
        self.assertEqual(evidence["mediaType"], "image/png")
        self.assertEqual(evidence["width"], 1254)
        self.assertEqual(evidence["height"], 1254)
        self.assertEqual(evidence["alphaMode"], "rgb")
        self.assertEqual(evidence["bytes"], len(provider_bytes))
        self.assertEqual(evidence["contentHash"], hashlib.sha256(provider_bytes).hexdigest())
        self.assertEqual(
            retained["normalization"]["sourceContentHash"], evidence["contentHash"]
        )
        self.assertIsNone(retained["normalization"]["decoderInputContentHash"])
        self.assertIsNone(retained["normalization"]["containerBox"])
        self.assertIsNone(retained["normalization"]["colorSpaceDisposition"])

    def test_profile_v2_completed_evidence_binds_full_source_decoder_and_cabx(self) -> None:
        provider_hash = hashlib.sha256(b"complete provider png").hexdigest()
        decoder_hash = hashlib.sha256(b"canonical decoder png").hexdigest()
        output_hash = hashlib.sha256(b"normalized candidate png").hexdigest()
        cabx_hash = hashlib.sha256(b"jumb container payload").hexdigest()
        target = {"normalization": {"profile": "skill-icon-green-key-role-mask-v2"}}
        result = {
            "normalization": {
                "profile": "skill-icon-green-key-role-mask-v2",
                "outcome": "completed",
                "providerSource": {"contentHash": provider_hash},
                "sourceContentHash": provider_hash,
                "decoderInputContentHash": decoder_hash,
                "containerBox": {
                    "chunkType": "caBX",
                    "bytes": 21,
                    "contentHash": cabx_hash,
                },
                "colorSpaceDisposition": "assigned-srgb",
                "outputContentHash": output_hash,
            }
        }
        verify_result_module._validate_profile_normalization_evidence(
            target, result, output_hash
        )
        # A later persistence/validation failure may retain completed hash evidence
        # even though no candidate pathname was retained.
        verify_result_module._validate_profile_normalization_evidence(
            target, result, None
        )

    def test_profile_v2_completed_evidence_rejects_path_or_payload_in_cabx(self) -> None:
        content_hash = hashlib.sha256(b"evidence").hexdigest()
        target = {"normalization": {"profile": "skill-icon-green-key-role-mask-v2"}}
        for forbidden_field in ("path", "payload"):
            with self.subTest(forbidden_field=forbidden_field):
                result = {
                    "normalization": {
                        "profile": "skill-icon-green-key-role-mask-v2",
                        "outcome": "completed",
                        "providerSource": {"contentHash": content_hash},
                        "sourceContentHash": content_hash,
                        "decoderInputContentHash": content_hash,
                        "containerBox": {
                            "chunkType": "caBX",
                            "bytes": 21,
                            "contentHash": content_hash,
                            forbidden_field: "forbidden",
                        },
                        "colorSpaceDisposition": "assigned-srgb",
                        "outputContentHash": content_hash,
                    }
                }
                with self.assertRaisesRegex(ValueError, "pathless caBX"):
                    verify_result_module._validate_profile_normalization_evidence(
                        target, result, content_hash
                    )

    def test_profile_v2_completed_evidence_rejects_hash_and_color_drift(self) -> None:
        content_hash = hashlib.sha256(b"evidence").hexdigest()
        target = {"normalization": {"profile": "skill-icon-green-key-role-mask-v2"}}
        baseline = {
            "profile": "skill-icon-green-key-role-mask-v2",
            "outcome": "completed",
            "providerSource": {"contentHash": content_hash},
            "sourceContentHash": content_hash,
            "decoderInputContentHash": content_hash,
            "containerBox": {
                "chunkType": "caBX",
                "bytes": 21,
                "contentHash": content_hash,
            },
            "colorSpaceDisposition": "assigned-srgb",
            "outputContentHash": content_hash,
        }
        for field, invalid in (
            ("sourceContentHash", "0" * 64),
            ("decoderInputContentHash", "not-a-hash"),
            ("colorSpaceDisposition", "declared-srgb"),
        ):
            with self.subTest(field=field):
                evidence = dict(baseline)
                evidence[field] = invalid
                with self.assertRaises(ValueError):
                    verify_result_module._validate_profile_normalization_evidence(
                        target, {"normalization": evidence}, content_hash
                    )

    def test_profile_v2_failed_evidence_rejects_partial_derived_provenance(self) -> None:
        content_hash = hashlib.sha256(b"evidence").hexdigest()
        target = {"normalization": {"profile": "skill-icon-green-key-role-mask-v2"}}
        derived = {
            "decoderInputContentHash": content_hash,
            "containerBox": {
                "chunkType": "caBX",
                "bytes": 21,
                "contentHash": content_hash,
            },
            "colorSpaceDisposition": "assigned-srgb",
        }
        for omitted_field in derived:
            with self.subTest(omitted_field=omitted_field):
                evidence = {
                    "profile": "skill-icon-green-key-role-mask-v2",
                    "outcome": "failed",
                    "providerSource": {"contentHash": content_hash},
                    "sourceContentHash": content_hash,
                    "outputContentHash": None,
                    **derived,
                }
                evidence[omitted_field] = None
                with self.assertRaisesRegex(ValueError, "all null or all present"):
                    verify_result_module._validate_profile_normalization_evidence(
                        target, {"normalization": evidence}, None
                    )

        all_null = {
            "profile": "skill-icon-green-key-role-mask-v2",
            "outcome": "failed",
            "providerSource": {"contentHash": content_hash},
            "sourceContentHash": content_hash,
            "decoderInputContentHash": None,
            "containerBox": None,
            "colorSpaceDisposition": None,
            "outputContentHash": None,
        }
        verify_result_module._validate_profile_normalization_evidence(
            target, {"normalization": all_null}, None
        )
        all_present = {**all_null, **derived}
        verify_result_module._validate_profile_normalization_evidence(
            target, {"normalization": all_present}, None
        )

    def test_profile_v3_uses_profile_v2_completed_and_failed_provenance(self) -> None:
        content_hash = hashlib.sha256(b"profile-v3 evidence").hexdigest()
        target = {"normalization": {"profile": "skill-icon-green-key-role-mask-v3"}}
        completed = {
            "profile": "skill-icon-green-key-role-mask-v3",
            "outcome": "completed",
            "providerSource": {"contentHash": content_hash},
            "sourceContentHash": content_hash,
            "decoderInputContentHash": content_hash,
            "containerBox": {
                "chunkType": "caBX",
                "bytes": 21,
                "contentHash": content_hash,
            },
            "colorSpaceDisposition": "assigned-srgb",
            "outputContentHash": content_hash,
        }
        verify_result_module._validate_profile_normalization_evidence(
            target, {"normalization": completed}, content_hash
        )

        failed = {**completed, "outcome": "failed", "outputContentHash": None}
        verify_result_module._validate_profile_normalization_evidence(
            target, {"normalization": failed}, None
        )
        for field in (
            "decoderInputContentHash",
            "containerBox",
            "colorSpaceDisposition",
        ):
            with self.subTest(field=field):
                partial = dict(failed)
                partial[field] = None
                with self.assertRaisesRegex(ValueError, "all null or all present"):
                    verify_result_module._validate_profile_normalization_evidence(
                        target, {"normalization": partial}, None
                    )

    def test_geometry_role_mask_binds_complete_pathless_v5_provenance(self) -> None:
        content_hash = hashlib.sha256(b"geometry-first evidence").hexdigest()
        target = {"normalization": {"profile": "skill-icon-geometry-role-mask-v1"}}
        completed = {
            "profile": "skill-icon-geometry-role-mask-v1",
            "outcome": "completed",
            "providerSource": {"contentHash": content_hash},
            "sourceContentHash": content_hash,
            "decoderInputContentHash": content_hash,
            "containerBox": {
                "chunkType": "caBX",
                "bytes": 21,
                "contentHash": content_hash,
            },
            "colorSpaceDisposition": "assigned-srgb",
            "outputContentHash": content_hash,
        }
        verify_result_module._validate_profile_normalization_evidence(
            target, {"normalization": completed}, content_hash
        )

        for mutation in (
            {**completed, "sourceContentHash": "0" * 64},
            {**completed, "decoderInputContentHash": None},
            {**completed, "containerBox": {**completed["containerBox"], "path": "raw.png"}},
            {**completed, "colorSpaceDisposition": "declared-srgb"},
            {**completed, "outputContentHash": "0" * 64},
        ):
            with self.subTest(mutation=mutation):
                with self.assertRaises(ValueError):
                    verify_result_module._validate_profile_normalization_evidence(
                        target, {"normalization": mutation}, content_hash
                    )

        leaked = dict(completed)
        leaked["containerBox"] = {**completed["containerBox"], "payload": "forbidden"}
        with self.assertRaisesRegex(ValueError, "pathless and exact|pathless caBX"):
            verify_result_module._validate_profile_normalization_evidence(
                target, {"normalization": leaked}, content_hash
            )

    def test_strict_geometry_role_mask_binds_complete_pathless_v6_provenance(self) -> None:
        content_hash = hashlib.sha256(b"strict geometry evidence").hexdigest()
        target = {"normalization": {"profile": "skill-icon-geometry-role-mask-v2"}}
        completed = {
            "profile": "skill-icon-geometry-role-mask-v2",
            "outcome": "completed",
            "providerSource": {"contentHash": content_hash},
            "sourceContentHash": content_hash,
            "decoderInputContentHash": content_hash,
            "containerBox": {
                "chunkType": "caBX",
                "bytes": 21,
                "contentHash": content_hash,
            },
            "colorSpaceDisposition": "assigned-srgb",
            "outputContentHash": content_hash,
        }
        verify_result_module._validate_profile_normalization_evidence(
            target, {"normalization": completed}, content_hash
        )

        rejected = dict(completed)
        rejected["colorSpaceDisposition"] = "declared-srgb"
        with self.assertRaises(ValueError):
            verify_result_module._validate_profile_normalization_evidence(
                target, {"normalization": rejected}, content_hash
            )

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
                started_at=STARTED_AT,
                completed_at=COMPLETED_AT,
                total_wall_time_ms=TOTAL_WALL_TIME_MS,
                contract_root=REPOSITORY_ROOT,
            )

    def test_timeout_after_two_attempts_preserves_actual_timing(self) -> None:
        self.packet.candidate_file.unlink()
        self.packet.result_file.unlink()
        report = persist_failed_result(
            self.packet.target,
            self.packet.assignment,
            self.packet.root,
            attempt_count=2,
            failure_kind="timeout",
            failure_message="Both permitted provider attempts timed out.",
            started_at="2026-09-01T17:01:00.000Z",
            total_wall_time_ms=300000,
            contract_root=REPOSITORY_ROOT,
        )
        retained = load_json(self.packet.root / RESULT_PATH)
        self.assertEqual(report["attemptCount"], 2)
        self.assertEqual(retained["failureReason"]["kind"], "timeout")
        self.assertEqual(retained["completedAt"], "2026-09-01T17:06:00.000Z")
        self.assertEqual(retained["totalWallTimeMs"], 300000)

    def test_result_only_failure_derives_duration_from_actual_completion(self) -> None:
        self.packet.candidate_file.unlink()
        self.packet.result_file.unlink()
        persist_failed_result(
            self.packet.target,
            self.packet.assignment,
            self.packet.root,
            attempt_count=1,
            failure_kind="provider-throttle",
            failure_message="The provider throttled the request.",
            started_at=STARTED_AT,
            completed_at=COMPLETED_AT,
            contract_root=REPOSITORY_ROOT,
        )
        retained = load_json(self.packet.root / RESULT_PATH)
        self.assertEqual(retained["completedAt"], COMPLETED_AT)
        self.assertEqual(retained["totalWallTimeMs"], TOTAL_WALL_TIME_MS)

    def test_elapsed_derivation_preserves_sub_millisecond_start_precision(self) -> None:
        self.packet.candidate_file.unlink()
        self.packet.result_file.unlink()
        persist_failed_result(
            self.packet.target,
            self.packet.assignment,
            self.packet.root,
            attempt_count=1,
            failure_kind="timeout",
            failure_message="The provider timed out after one millisecond.",
            started_at="2026-09-01T17:01:00.000500Z",
            total_wall_time_ms=1,
            contract_root=REPOSITORY_ROOT,
        )
        retained = load_json(self.packet.root / RESULT_PATH)
        self.assertEqual(retained["completedAt"], "2026-09-01T17:01:00.001500Z")
        self.assertEqual(retained["totalWallTimeMs"], 1)

    def test_result_only_failure_rejects_invalid_timing_without_writing(self) -> None:
        self.packet.candidate_file.unlink()
        self.packet.result_file.unlink()
        invalid_timings = [
            (COMPLETED_AT, STARTED_AT, TOTAL_WALL_TIME_MS),
            (STARTED_AT, COMPLETED_AT, 1),
            ("2026-09-01T17:01:00", COMPLETED_AT, TOTAL_WALL_TIME_MS),
        ]
        for started_at, completed_at, total_wall_time_ms in invalid_timings:
            with self.subTest(
                started_at=started_at,
                completed_at=completed_at,
                total_wall_time_ms=total_wall_time_ms,
            ):
                with self.assertRaisesRegex(ValueError, "timestamp|timing|duration"):
                    persist_failed_result(
                        self.packet.target,
                        self.packet.assignment,
                        self.packet.root,
                        attempt_count=1,
                        failure_kind="timeout",
                        failure_message="The provider timed out.",
                        started_at=started_at,
                        completed_at=completed_at,
                        total_wall_time_ms=total_wall_time_ms,
                        contract_root=REPOSITORY_ROOT,
                    )
                self.assertFalse((self.packet.root / RESULT_PATH).exists())

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

    def test_rejects_tampered_wall_time_duration(self) -> None:
        self.packet.result["startedAt"] = "2026-09-01T17:01:00.000500Z"
        self.packet.result["completedAt"] = "2026-09-01T17:01:00.001500Z"
        self.packet.result["totalWallTimeMs"] = 2
        self.packet.rewrite_result()
        self.assert_invalid("duration")

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

    def test_rejects_result_file_symlink(self) -> None:
        real_result = self.packet.result_file.with_suffix(".real.json")
        self.packet.result_file.rename(real_result)
        self.packet.result_file.symlink_to(real_result)
        with self.assertRaisesRegex(ValueError, "symbolic link|Too many levels"):
            self.packet.verify()

    def test_rejects_same_byte_result_path_swap_before_success(self) -> None:
        original_changed_paths = verify_result_module._changed_repository_paths
        swapped = False

        def swap_after_dirty_audit(workspace: Path) -> set[str]:
            nonlocal swapped
            changed = original_changed_paths(workspace)
            if not swapped:
                result_bytes = self.packet.result_file.read_bytes()
                displaced = self.packet.result_file.with_suffix(".displaced.json")
                self.packet.result_file.rename(displaced)
                self.packet.result_file.write_bytes(result_bytes)
                displaced.unlink()
                swapped = True
            return changed

        with patch.object(
            verify_result_module,
            "_changed_repository_paths",
            side_effect=swap_after_dirty_audit,
        ):
            self.assert_invalid("retained result changed before verification completed")


if __name__ == "__main__":
    unittest.main()
