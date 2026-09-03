#!/usr/bin/env python3
"""Tests for coordinator-only, source-bound correction materialization."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


HERE = Path(__file__).resolve().parent
SCRIPTS = HERE.parent / "scripts"
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(SCRIPTS))

import materialize_correction as correction  # noqa: E402
from contracts import (  # noqa: E402
    ContractError,
    assignment_path_for,
    sha256_json,
    target_path_for,
    validate_assignment,
    validate_target,
)
from test_contracts import WorkspaceFixture, fake_png  # noqa: E402
from persist_candidate import persist_candidate  # noqa: E402
from write_result import write_result  # noqa: E402


class CorrectionFixture(WorkspaceFixture):
    def complete_revise(self) -> tuple[dict, dict, dict, Path, Path, Path]:
        target = self.target()
        assignment = self.assignment(target)
        target_path, assignment_path = self.materialize_envelope(target, assignment)
        source = self.root / "provider-revise.png"
        source.write_bytes(fake_png())
        receipt = persist_candidate(
            source,
            target_path,
            assignment_path,
            self.root,
            source_output_id="provider-revise",
        )
        result = self.candidate_result(target, assignment, receipt)
        result["status"] = "revise"
        result["selectedAttemptId"] = None
        result["failedCriteria"] = ["complete-image"]
        result["attempts"][0]["conclusion"] = "rejected-by-producer"
        result["attempts"][0]["findings"][0]["outcome"] = "fail"
        result["attempts"][0]["findings"][0]["observation"] = "Left hand has six fingers."
        result["attempts"][0]["retryReason"] = "Left hand has six fingers."
        result_path = self.root / target["output"]["resultPath"]
        write_result(target_path, assignment_path, result, self.root)
        return target, assignment, result, target_path, assignment_path, result_path


class MaterializeCorrectionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fixture = CorrectionFixture()

    def tearDown(self) -> None:
        self.fixture.close()

    def invoke(self, *, mode: str = "edit") -> dict:
        _target, _assignment, _result, target_path, assignment_path, result_path = (
            self.fixture.complete_revise()
        )
        return correction.materialize_correction(
            target_path,
            assignment_path,
            result_path,
            self.fixture.root,
            producer_id="producer-correction",
            assigned_at="2026-09-02T14:00:00Z",
            defect="Left hand has six fingers; restore exactly five.",
            mode=mode,
        )

    def test_materializes_strict_v2_edit_and_preserves_original_order(self) -> None:
        source_target, _source_assignment, source_result, target_path, assignment_path, result_path = (
            self.fixture.complete_revise()
        )
        report = correction.materialize_correction(
            target_path,
            assignment_path,
            result_path,
            self.fixture.root,
            producer_id="producer-correction",
            assigned_at="2026-09-02T14:00:00Z",
            defect="Left hand has six fingers; restore exactly five.",
            mode="edit",
        )
        target_v2 = json.loads((self.fixture.root / report["targetPath"]).read_text())
        assignment_v2 = json.loads((self.fixture.root / report["assignmentPath"]).read_text())
        self.assertEqual(target_v2["targetVersion"], 2)
        self.assertEqual(target_v2["heroSpec"], source_target["heroSpec"])
        self.assertEqual(
            target_v2["references"][:-1], source_target["references"]
        )
        self.assertEqual(target_v2["references"][-1]["role"], "correction-source")
        self.assertEqual(
            target_v2["correctionSource"],
            {
                "targetId": source_target["targetId"],
                "resultPath": source_target["output"]["resultPath"],
                "candidatePath": source_target["output"]["candidatePath"],
                "sha256": source_result["candidate"]["sha256"],
            },
        )
        prompt = target_v2["canonicalPrompt"]["text"]
        self.assertIn("Correction mode: edit", prompt)
        self.assertIn("Left hand has six fingers", prompt)
        self.assertIn("Preserve every passing trait", prompt)
        self.assertIn("every original invariant", prompt)
        self.assertIn(source_target["canonicalPrompt"]["text"], prompt)
        self.assertEqual(target_v2["canonicalPrompt"]["sha256"], correction.sha256_bytes(prompt.encode()))
        self.assertEqual(assignment_v2["targetSha256"], sha256_json(target_v2))
        validate_target(target_v2, expected_path=report["targetPath"])
        validate_assignment(assignment_v2, target_v2, expected_path=report["assignmentPath"])
        self.assertFalse((self.fixture.root / report["candidatePath"]).exists())
        self.assertFalse((self.fixture.root / report["resultPath"]).exists())

    def test_regeneration_mode_is_explicit(self) -> None:
        report = self.invoke(mode="regeneration")
        target = json.loads((self.fixture.root / report["targetPath"]).read_text())
        prompt = target["canonicalPrompt"]["text"]
        self.assertIn("Correction mode: regeneration", prompt)
        self.assertIn("complete regeneration", prompt)
        self.assertIn("identity and continuity authority", prompt)

    def test_checkpoint_authorizes_one_defect_correction_of_candidate(self) -> None:
        target = self.fixture.target()
        assignment, _receipt, result = self.fixture.complete_candidate(target)
        target_path = self.fixture.root / assignment["targetPath"]
        assignment_path = self.fixture.root / assignment_path_for(
            target["waveId"], target["heroId"], target["imageKind"], 1
        )
        result_path = self.fixture.root / target["output"]["resultPath"]
        evidence_path = (
            "assets/heroes/experiments/one-star-overnight-200-001/"
            "review-evidence/wave-01-arbitration.json"
        )
        evidence = {
            "schemaVersion": "hero-one-star-checkpoint-arbitration-v1",
            "experimentId": target["experimentId"],
            "waveId": target["waveId"],
            "candidateBoundary": "candidate-only; objective authoring review, not human approval",
            "findings": [
                {
                    "heroId": target["heroId"],
                    "selectedResultPath": target["output"]["resultPath"],
                    "selectedResultSha256": sha256_json(result),
                    "verdict": "fail",
                    "blockingCriteria": ["complete-image"],
                    "evidence": "Independent inspection found one objective blocker.",
                }
            ],
        }
        self.fixture.write_json(evidence_path, evidence)
        report = correction.materialize_correction(
            target_path,
            assignment_path,
            result_path,
            self.fixture.root,
            producer_id="producer-correction",
            assigned_at="2026-09-02T14:00:00Z",
            defect="Restore the missing source-bound object.",
            mode="edit",
            checkpoint_inspection_path=self.fixture.root / evidence_path,
        )
        target_v2 = json.loads((self.fixture.root / report["targetPath"]).read_text())
        self.assertIn("CHECKPOINT CORRECTION AUTHORITY", target_v2["canonicalPrompt"]["text"])
        self.assertIn(sha256_json(evidence), target_v2["canonicalPrompt"]["text"])

    def test_rejects_candidate_status_and_stale_candidate_bytes(self) -> None:
        target = self.fixture.target()
        assignment, _receipt, _result = self.fixture.complete_candidate(target)
        target_path = self.fixture.root / assignment["targetPath"]
        assignment_path = self.fixture.root / assignment_path_for(
            target["waveId"], target["heroId"], target["imageKind"], 1
        )
        result_path = self.fixture.root / target["output"]["resultPath"]
        with self.assertRaisesRegex(ContractError, "revise result"):
            correction.materialize_correction(
                target_path,
                assignment_path,
                result_path,
                self.fixture.root,
                producer_id="producer-correction",
                assigned_at="2026-09-02T14:00:00Z",
                defect="A defect.",
                mode="edit",
            )

        self.fixture.close()
        self.fixture = CorrectionFixture()
        _target, _assignment, _result, target_path, assignment_path, result_path = (
            self.fixture.complete_revise()
        )
        candidate_path = self.fixture.root / _target["output"]["candidatePath"]
        candidate_path.write_bytes(fake_png() + b"drift")
        with self.assertRaisesRegex(ContractError, "do not match"):
            correction.materialize_correction(
                target_path,
                assignment_path,
                result_path,
                self.fixture.root,
                producer_id="producer-correction",
                assigned_at="2026-09-02T14:00:00Z",
                defect="A defect.",
                mode="edit",
            )

    def test_collision_is_no_write(self) -> None:
        target, _assignment, _result, target_path, assignment_path, result_path = (
            self.fixture.complete_revise()
        )
        collision_relative = assignment_path_for(
            target["waveId"], target["heroId"], target["imageKind"], 2
        )
        sentinel = b"owner-data"
        self.fixture.write_bytes(collision_relative, sentinel)
        v2_target_relative = target_path_for(
            target["waveId"], target["heroId"], target["imageKind"], 2
        )
        with self.assertRaisesRegex(ContractError, "collision"):
            correction.materialize_correction(
                target_path,
                assignment_path,
                result_path,
                self.fixture.root,
                producer_id="producer-correction",
                assigned_at="2026-09-02T14:00:00Z",
                defect="A defect.",
                mode="edit",
            )
        self.assertFalse((self.fixture.root / v2_target_relative).exists())
        self.assertEqual((self.fixture.root / collision_relative).read_bytes(), sentinel)

    def test_second_create_failure_rolls_back_only_created_target(self) -> None:
        target, _assignment, _result, target_path, assignment_path, result_path = (
            self.fixture.complete_revise()
        )
        real_create = correction.anchored_exclusive_create
        calls = 0

        def fail_second(workspace: Path, relative_path: str, payload: bytes):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise FileExistsError("simulated assignment publication race")
            return real_create(workspace, relative_path, payload)

        v2_target_relative = target_path_for(
            target["waveId"], target["heroId"], target["imageKind"], 2
        )
        with patch.object(correction, "anchored_exclusive_create", side_effect=fail_second):
            with self.assertRaises(FileExistsError):
                correction.materialize_correction(
                    target_path,
                    assignment_path,
                    result_path,
                    self.fixture.root,
                    producer_id="producer-correction",
                    assigned_at="2026-09-02T14:00:00Z",
                    defect="A defect.",
                    mode="edit",
                )
        self.assertFalse((self.fixture.root / v2_target_relative).exists())


if __name__ == "__main__":
    unittest.main()
