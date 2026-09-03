#!/usr/bin/env python3
"""Tests for coordinator-only, hash-bound chibi envelope materialization."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path
from unittest import mock


HERE = Path(__file__).resolve().parent
SCRIPTS = HERE.parent / "scripts"
WORKSPACE = HERE.parents[4]
sys.path.insert(0, str(SCRIPTS))
sys.path.insert(0, str(HERE))

import activate_reserve as activation  # noqa: E402
import materialize_chibi as chibi  # noqa: E402
from contracts import (  # noqa: E402
    ContractError,
    assignment_path_for,
    canonical_json,
    candidate_path_for,
    result_path_for,
    sha256_bytes,
    sha256_json,
    target_path_for,
    validate_assignment,
    validate_target,
)


def fake_png(width: int = 1024, height: int = 1536) -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n"
        + (13).to_bytes(4, "big")
        + b"IHDR"
        + width.to_bytes(4, "big")
        + height.to_bytes(4, "big")
        + b"\x08\x02\x00\x00\x00"
        + b"summon-candidate-pixels"
    )


class ChibiWorkspace:
    def __init__(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.plan = json.loads(
            (WORKSPACE / chibi.ROSTER_PATH).read_text(encoding="utf-8")
        )
        self.packet = self.plan["active"][0]
        self.hero_id = self.packet["heroId"]
        self.wave_id = self.packet["waveId"]
        self.target = self.packet["summonTarget"]
        self.assignment = self.packet["summonAssignment"]
        self.write_json(chibi.ROSTER_PATH, self.plan)
        self.write_json(self.packet["summonTargetPath"], self.target)
        self.write_json(self.packet["summonAssignmentPath"], self.assignment)
        style = self.plan["styleReference"]
        self.write_bytes(style["path"], (WORKSPACE / style["path"]).read_bytes())
        self.candidate_bytes = fake_png()
        self.write_bytes(self.target["output"]["candidatePath"], self.candidate_bytes)
        self.result = self.make_result()
        self.write_json(self.target["output"]["resultPath"], self.result)

    def close(self) -> None:
        self.temporary.cleanup()

    def write_bytes(self, relative: str, payload: bytes) -> None:
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(payload)

    def write_json(self, relative: str, value: object) -> None:
        self.write_bytes(relative, (canonical_json(value) + "\n").encode("utf-8"))

    def make_result(
        self,
        target: dict | None = None,
        assignment: dict | None = None,
        candidate_bytes: bytes | None = None,
    ) -> dict:
        target = target or self.target
        assignment = assignment or self.assignment
        candidate_bytes = candidate_bytes or self.candidate_bytes
        candidate_path = target["output"]["candidatePath"]
        candidate_hash = sha256_bytes(candidate_bytes)
        source = {
            "outputId": "provider-summon-1",
            "path": "/provider/summon.png",
            "mediaType": "image/png",
            "width": 1024,
            "height": 1536,
            "bytes": len(candidate_bytes),
            "sha256": candidate_hash,
        }
        retained = {
            key: value for key, value in source.items() if key != "outputId"
        }
        retained["path"] = candidate_path
        receipt = {"operation": "anchored-exclusive-copy", "source": source, "retained": retained}
        attempt_id = f"{self.hero_id}-summon-v{target['targetVersion']}-attempt-1"
        findings = [
            {
                "criterionId": criterion["criterionId"],
                "evaluator": "producer",
                "outcome": "pass",
                "observation": "Required summon criterion passes.",
            }
            for criterion in target["acceptanceCriteria"]
        ]
        return {
            "schemaVersion": "hero-one-star-image-result-v1",
            "resultId": f"result-{target['targetId']}",
            "experimentId": chibi.EXPERIMENT_ID,
            "targetId": target["targetId"],
            "targetSha256": sha256_json(target),
            "assignmentId": assignment["assignmentId"],
            "assignmentSha256": sha256_json(assignment),
            "producerId": assignment["producerId"],
            "status": "candidate",
            "attempts": [
                {
                    "attemptId": attempt_id,
                    "attemptNumber": 1,
                    "precedingAttemptId": None,
                    "conclusion": "accepted-by-producer",
                    "failureKind": None,
                    "exactPrompt": target["canonicalPrompt"]["text"],
                    "promptSha256": target["canonicalPrompt"]["sha256"],
                    "referenceInputs": [
                        {"path": reference["path"], "sha256": reference["sha256"]}
                        for reference in target["references"]
                    ],
                    "requestStartedAt": "2026-09-02T10:00:00Z",
                    "generationCompletedAt": "2026-09-02T10:00:10Z",
                    "inspectionCompletedAt": "2026-09-02T10:00:12Z",
                    "generationDurationMs": 10000,
                    "inspectionDurationMs": 2000,
                    "totalWallTimeMs": 12000,
                    "sourceOutput": source,
                    "persistence": receipt,
                    "findings": findings,
                    "retryReason": None,
                }
            ],
            "selectedAttemptId": attempt_id,
            "failedCriteria": [],
            "candidate": retained,
            "startedAt": "2026-09-02T10:00:00Z",
            "completedAt": "2026-09-02T10:00:12Z",
            "totalWallTimeMs": 12000,
            "writtenOutputPaths": [candidate_path, target["output"]["resultPath"]],
            "attestations": {
                "noSharedFilesEdited": True,
                "selfPromoted": False,
                "candidateOnly": True,
            },
        }

    def install_corrected_v2(self) -> tuple[dict, dict, dict, bytes]:
        # The v1 render remains valid evidence but needs correction; the v2
        # target binds its exact retained bytes as the immediate source.
        self.result["status"] = "revise"
        self.result["selectedAttemptId"] = None
        self.result["failedCriteria"] = [
            self.target["acceptanceCriteria"][0]["criterionId"]
        ]
        self.write_json(self.target["output"]["resultPath"], self.result)
        source = {
            "targetId": self.target["targetId"],
            "resultPath": self.target["output"]["resultPath"],
            "candidatePath": self.target["output"]["candidatePath"],
            "sha256": self.result["candidate"]["sha256"],
        }
        target = deepcopy(self.target)
        target["targetId"] = f"{self.hero_id}-summon-v2"
        target["targetVersion"] = 2
        target["correctionSource"] = source
        target["references"].append(
            {
                "path": source["candidatePath"],
                "sha256": source["sha256"],
                "purpose": "Exact preceding summon candidate; correct only the declared issue.",
                "role": "correction-source",
            }
        )
        prompt = target["canonicalPrompt"]["text"] + " Correct only the declared v1 issue."
        target["canonicalPrompt"] = {"text": prompt, "sha256": sha256_bytes(prompt.encode("utf-8"))}
        target["output"] = {
            "candidatePath": candidate_path_for(self.wave_id, self.hero_id, "summon", 2),
            "resultPath": result_path_for(self.wave_id, self.hero_id, "summon", 2),
        }
        assignment = deepcopy(self.assignment)
        assignment["assignmentId"] = f"{self.hero_id}-summon-v2-assignment"
        assignment["targetId"] = target["targetId"]
        assignment["targetPath"] = target_path_for(self.wave_id, self.hero_id, "summon", 2)
        assignment["targetSha256"] = sha256_json(target)
        assignment["permittedOutputs"] = target["output"]
        corrected_bytes = fake_png() + b"-corrected-v2"
        result = self.make_result(target, assignment, corrected_bytes)
        self.write_json(assignment["targetPath"], target)
        self.write_json(
            assignment_path_for(self.wave_id, self.hero_id, "summon", 2), assignment
        )
        self.write_bytes(target["output"]["candidatePath"], corrected_bytes)
        self.write_json(target["output"]["resultPath"], result)
        return target, assignment, result, corrected_bytes

    def activate_selected_reserve(self, reserve_id: str = "wenyn-amarun") -> dict:
        failed_id = self.hero_id
        self.failed_target = self.target
        for evidence in (activation.RESERVE_ANALYSIS, activation.CALIBRATION_INSPECTION):
            self.write_bytes(evidence, (WORKSPACE / evidence).read_bytes())
        receipt = activation.activate_reserve(
            self.root / chibi.ROSTER_PATH,
            self.root,
            failed_active_hero_id=failed_id,
            reserve_hero_id=reserve_id,
            destination_wave=self.wave_id,
            producer_id="image-producer-reserve-test",
            assigned_at="2026-09-03T05:00:00Z",
            created_at="2026-09-03T04:59:00Z",
            reason="Documented calibration quarantine; activate approved reserve.",
        )
        self.activation_record = json.loads(
            (self.root / receipt["activationPath"]).read_text(encoding="utf-8")
        )
        self.hero_id = reserve_id
        self.target = json.loads(
            (self.root / receipt["targetPath"]).read_text(encoding="utf-8")
        )
        self.assignment = json.loads(
            (self.root / receipt["assignmentPath"]).read_text(encoding="utf-8")
        )
        self.candidate_bytes = fake_png() + b"-activated-reserve"
        self.write_bytes(self.target["output"]["candidatePath"], self.candidate_bytes)
        self.result = self.make_result()
        self.write_json(self.target["output"]["resultPath"], self.result)
        return receipt


class MaterializeChibiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fixture = ChibiWorkspace()

    def tearDown(self) -> None:
        self.fixture.close()

    def materialize(self) -> dict:
        return chibi.materialize_chibi(
            self.fixture.hero_id,
            self.fixture.wave_id,
            self.fixture.root,
            producer_id="image-producer-chibi-test",
            assigned_at="2026-09-02T11:00:00Z",
        )

    def test_materializes_contract_valid_exactly_bound_envelope(self) -> None:
        report = self.materialize()
        target = json.loads((self.fixture.root / report["targetPath"]).read_text(encoding="utf-8"))
        assignment = json.loads(
            (self.fixture.root / report["assignmentPath"]).read_text(encoding="utf-8")
        )
        self.assertEqual(validate_target(target, expected_path=report["targetPath"]), target)
        self.assertEqual(
            validate_assignment(assignment, target, expected_path=report["assignmentPath"]),
            assignment,
        )
        self.assertEqual(len(target["references"]), 1)
        self.assertEqual(target["references"][0]["role"], "identity-anatomy-authority")
        self.assertEqual(target["sourceSummon"]["candidatePath"], self.fixture.target["output"]["candidatePath"])
        self.assertEqual(target["sourceSummon"]["sha256"], sha256_bytes(self.fixture.candidate_bytes))
        self.assertIn(self.fixture.target["targetId"], target["references"][0]["purpose"])
        self.assertIn(self.fixture.result["resultId"], target["references"][0]["purpose"])
        self.assertEqual(assignment["targetSha256"], sha256_json(target))

    def test_prompt_freezes_required_continuity_and_ratio(self) -> None:
        report = self.materialize()
        target = json.loads((self.fixture.root / report["targetPath"]).read_text(encoding="utf-8"))
        prompt = target["canonicalPrompt"]["text"].casefold()
        for phrase in (
            "1024 x 1536",
            "2.75 to 3.1 heads total",
            "32 to 36 percent",
            "never render a 3.5-head, 4-head, or tall-miniature figure",
            "shoulder and torso width",
            "upper-arm and forearm girth",
            "wrist scale",
            "hand size",
            "hair continuity",
            "wardrobe continuity",
            "adult age cues",
            "without replacing the source eye shape",
            "generic doll-face template",
            "add nothing new",
        ):
                self.assertIn(phrase, prompt)

    def test_explicit_corrected_v2_becomes_exact_selected_authority(self) -> None:
        corrected_target, _, corrected_result, corrected_bytes = self.fixture.install_corrected_v2()
        report = chibi.materialize_chibi(
            self.fixture.hero_id,
            self.fixture.wave_id,
            self.fixture.root,
            summon_version=2,
            producer_id="image-producer-chibi-test",
            assigned_at="2026-09-02T11:00:00Z",
        )
        target = json.loads((self.fixture.root / report["targetPath"]).read_text(encoding="utf-8"))
        self.assertEqual(report["summonVersion"], 2)
        self.assertEqual(target["sourceSummon"]["targetId"], corrected_target["targetId"])
        self.assertEqual(target["sourceSummon"]["resultPath"], corrected_target["output"]["resultPath"])
        self.assertEqual(target["sourceSummon"]["candidatePath"], corrected_target["output"]["candidatePath"])
        self.assertEqual(target["sourceSummon"]["sha256"], sha256_bytes(corrected_bytes))
        self.assertIn(corrected_result["resultId"], target["references"][0]["purpose"])

    def test_rejects_revise_v1_without_explicit_selected_correction(self) -> None:
        self.fixture.result["status"] = "revise"
        self.fixture.result["selectedAttemptId"] = None
        self.fixture.result["failedCriteria"] = [
            self.fixture.target["acceptanceCriteria"][0]["criterionId"]
        ]
        self.fixture.write_json(self.fixture.target["output"]["resultPath"], self.fixture.result)
        with self.assertRaisesRegex(ContractError, "verified candidate"):
            self.materialize()
        target_path = chibi.target_path_for(
            self.fixture.wave_id, self.fixture.hero_id, "combat-chibi", 1
        )
        self.assertFalse((self.fixture.root / target_path).exists())

    def test_rejects_stale_summon_bytes_before_writing(self) -> None:
        self.fixture.write_bytes(self.fixture.target["output"]["candidatePath"], fake_png() + b"tampered")
        with self.assertRaisesRegex(ContractError, "hash or byte count"):
            self.materialize()
        target_path = chibi.target_path_for(
            self.fixture.wave_id, self.fixture.hero_id, "combat-chibi", 1
        )
        self.assertFalse((self.fixture.root / target_path).exists())

    def test_preflight_collision_and_symlink_are_no_mutation_failures(self) -> None:
        target_path = chibi.target_path_for(
            self.fixture.wave_id, self.fixture.hero_id, "combat-chibi", 1
        )
        assignment_path = assignment_path_for(
            self.fixture.wave_id, self.fixture.hero_id, "combat-chibi", 1
        )
        outside = self.fixture.root / "outside-owner-file"
        outside.write_text("owner", encoding="utf-8")
        collision = self.fixture.root / target_path
        collision.symlink_to(outside)
        with self.assertRaisesRegex(ContractError, "symbolic link|collision"):
            self.materialize()
        self.assertEqual(outside.read_text(encoding="utf-8"), "owner")
        self.assertFalse((self.fixture.root / assignment_path).exists())

    def test_second_create_failure_rolls_back_exact_first_inode(self) -> None:
        original_create = chibi.anchored_exclusive_create
        calls = 0

        def fail_second(workspace: Path, relative_path: str, payload: bytes):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise OSError("injected assignment creation failure")
            return original_create(workspace, relative_path, payload)

        with mock.patch.object(chibi, "anchored_exclusive_create", side_effect=fail_second):
            with self.assertRaisesRegex(OSError, "injected assignment creation failure"):
                self.materialize()
        target_path = chibi.target_path_for(
            self.fixture.wave_id, self.fixture.hero_id, "combat-chibi", 1
        )
        assignment_path = assignment_path_for(
            self.fixture.wave_id, self.fixture.hero_id, "combat-chibi", 1
        )
        self.assertFalse((self.fixture.root / target_path).exists())
        self.assertFalse((self.fixture.root / assignment_path).exists())

    def test_activated_reserve_v1_is_effective_packet_and_identity_authority(self) -> None:
        self.fixture.close()
        self.fixture = ChibiWorkspaceForFenel()
        self.fixture.activate_selected_reserve()
        report = self.materialize()
        target = json.loads((self.fixture.root / report["targetPath"]).read_text())
        record = self.fixture.activation_record
        self.assertEqual(target["heroId"], "wenyn-amarun")
        self.assertEqual(target["waveId"], "wave-01")
        self.assertEqual(
            target["heroSpec"]["identity"]["identitySignature"],
            record["preservedReserveIdentity"]["activatedIdentitySignature"],
        )
        self.assertEqual(target["heroSpec"], self.fixture.target["heroSpec"])
        self.assertEqual(
            target["sourceSummon"]["candidatePath"],
            record["materialized"]["candidatePath"],
        )

    def test_activation_chain_rejects_replaced_failed_hero(self) -> None:
        self.fixture.close()
        self.fixture = ChibiWorkspaceForFenel()
        failed_id = self.fixture.hero_id
        self.fixture.activate_selected_reserve()
        with self.assertRaisesRegex(ContractError, "not selected"):
            chibi.materialize_chibi(failed_id, "wave-01", self.fixture.root)

    def test_activated_reserve_can_select_a_corrected_summon_version(self) -> None:
        self.fixture.close()
        self.fixture = ChibiWorkspaceForFenel()
        self.fixture.activate_selected_reserve()
        corrected_target, _, corrected_result, corrected_bytes = self.fixture.install_corrected_v2()
        report = chibi.materialize_chibi(
            self.fixture.hero_id,
            self.fixture.wave_id,
            self.fixture.root,
            summon_version=2,
            producer_id="image-producer-chibi-test",
            assigned_at="2026-09-03T05:10:00Z",
        )
        target = json.loads((self.fixture.root / report["targetPath"]).read_text())
        self.assertEqual(report["summonVersion"], 2)
        self.assertEqual(target["sourceSummon"]["targetId"], corrected_target["targetId"])
        self.assertEqual(target["sourceSummon"]["sha256"], sha256_bytes(corrected_bytes))
        self.assertIn(corrected_result["resultId"], target["references"][0]["purpose"])


class ChibiWorkspaceForFenel(ChibiWorkspace):
    def __init__(self) -> None:
        super().__init__()
        fenel = next(packet for packet in self.plan["active"] if packet["heroId"] == "fenel-esho")
        self.packet = fenel
        self.hero_id = fenel["heroId"]
        self.wave_id = fenel["waveId"]
        self.target = fenel["summonTarget"]
        self.assignment = fenel["summonAssignment"]
        self.write_json(fenel["summonTargetPath"], self.target)
        self.write_json(fenel["summonAssignmentPath"], self.assignment)
        self.candidate_bytes = fake_png() + b"-fenel"
        self.write_bytes(self.target["output"]["candidatePath"], self.candidate_bytes)
        self.result = self.make_result()
        self.write_json(self.target["output"]["resultPath"], self.result)


if __name__ == "__main__":
    unittest.main()
