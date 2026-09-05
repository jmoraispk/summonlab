#!/usr/bin/env python3
"""Tests for coordinator-only provider no-output retry materialization."""

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

import materialize_provider_retry as provider_retry  # noqa: E402
from contracts import (  # noqa: E402
    ContractError,
    assignment_path_for,
    candidate_path_for,
    result_path_for,
    sha256_json,
    target_path_for,
    validate_assignment,
    validate_target,
)
from test_contracts import WorkspaceFixture, fake_png  # noqa: E402
from write_result import write_result  # noqa: E402


class ProviderRetryFixture(WorkspaceFixture):
    def failed_result(
        self,
        target: dict,
        assignment: dict,
        *,
        failure_kind: str = "other",
    ) -> dict:
        attempt_id = f"{target['heroId']}-{target['imageKind']}-provider-attempt-1"
        return {
            "schemaVersion": "hero-one-star-image-result-v1",
            "resultId": f"result-{target['targetId']}",
            "experimentId": target["experimentId"],
            "targetId": target["targetId"],
            "targetSha256": sha256_json(target),
            "assignmentId": assignment["assignmentId"],
            "assignmentSha256": sha256_json(assignment),
            "producerId": assignment["producerId"],
            "status": "failed",
            "attempts": [
                {
                    "attemptId": attempt_id,
                    "attemptNumber": 1,
                    "precedingAttemptId": None,
                    "conclusion": "provider-failure",
                    "failureKind": failure_kind,
                    "exactPrompt": target["canonicalPrompt"]["text"],
                    "promptSha256": target["canonicalPrompt"]["sha256"],
                    "referenceInputs": [
                        {"path": ref["path"], "sha256": ref["sha256"]}
                        for ref in target["references"]
                    ],
                    "requestStartedAt": "2026-09-02T12:00:00Z",
                    "generationCompletedAt": "2026-09-02T12:00:10Z",
                    "inspectionCompletedAt": "2026-09-02T12:00:12Z",
                    "generationDurationMs": 10000,
                    "inspectionDurationMs": 2000,
                    "totalWallTimeMs": 12000,
                    "sourceOutput": None,
                    "persistence": None,
                    "findings": [
                        {
                            "criterionId": "complete-image",
                            "evaluator": "automated",
                            "outcome": "fail",
                            "observation": "Provider returned no bindable image or exact source path.",
                        }
                    ],
                    "retryReason": None,
                }
            ],
            "selectedAttemptId": None,
            "failedCriteria": ["complete-image"],
            "candidate": None,
            "startedAt": "2026-09-02T12:00:00Z",
            "completedAt": "2026-09-02T12:00:12Z",
            "totalWallTimeMs": 12000,
            "writtenOutputPaths": [target["output"]["resultPath"]],
            "attestations": {
                "noSharedFilesEdited": True,
                "selfPromoted": False,
                "candidateOnly": True,
            },
        }

    def complete_failure(
        self, *, failure_kind: str = "other"
    ) -> tuple[dict, dict, dict, Path, Path, Path]:
        target = self.target()
        assignment = self.assignment(target)
        target_path, assignment_path = self.materialize_envelope(target, assignment)
        result = self.failed_result(
            target, assignment, failure_kind=failure_kind
        )
        result_path = self.root / target["output"]["resultPath"]
        write_result(target_path, assignment_path, result, self.root)
        return target, assignment, result, target_path, assignment_path, result_path


class MaterializeProviderRetryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fixture = ProviderRetryFixture()

    def tearDown(self) -> None:
        self.fixture.close()

    def invoke(self, *, failure_kind: str = "other") -> dict:
        _target, _assignment, _result, target_path, assignment_path, result_path = (
            self.fixture.complete_failure(failure_kind=failure_kind)
        )
        return provider_retry.materialize_provider_retry(
            target_path,
            assignment_path,
            result_path,
            self.fixture.root,
            assigned_at="2026-09-03T07:00:00Z",
        )

    def test_materializes_exact_v2_retry_and_preserves_source_bytes(self) -> None:
        source_target, source_assignment, _source_result, target_path, assignment_path, result_path = (
            self.fixture.complete_failure()
        )
        source_bytes = {
            path: path.read_bytes()
            for path in (target_path, assignment_path, result_path)
        }
        report = provider_retry.materialize_provider_retry(
            target_path,
            assignment_path,
            result_path,
            self.fixture.root,
            assigned_at="2026-09-03T07:00:00Z",
        )
        target_v2 = json.loads((self.fixture.root / report["targetPath"]).read_text())
        assignment_v2 = json.loads(
            (self.fixture.root / report["assignmentPath"]).read_text()
        )

        self.assertEqual(target_v2["targetVersion"], 2)
        self.assertEqual(target_v2["heroId"], source_target["heroId"])
        self.assertEqual(target_v2["imageKind"], source_target["imageKind"])
        self.assertEqual(target_v2["heroSpec"], source_target["heroSpec"])
        self.assertEqual(target_v2["presentation"], source_target["presentation"])
        self.assertEqual(
            target_v2["acceptanceCriteria"], source_target["acceptanceCriteria"]
        )
        self.assertEqual(
            target_v2["canonicalPrompt"], source_target["canonicalPrompt"]
        )
        self.assertEqual(target_v2["references"], source_target["references"])
        self.assertIsNone(target_v2["correctionSource"])
        self.assertEqual(
            target_v2["output"],
            {
                "candidatePath": candidate_path_for(
                    source_target["waveId"],
                    source_target["heroId"],
                    source_target["imageKind"],
                    2,
                ),
                "resultPath": result_path_for(
                    source_target["waveId"],
                    source_target["heroId"],
                    source_target["imageKind"],
                    2,
                ),
            },
        )
        self.assertEqual(
            assignment_v2["producerId"], source_assignment["producerId"]
        )
        self.assertEqual(assignment_v2["assignedAt"], "2026-09-03T07:00:00Z")
        self.assertEqual(assignment_v2["targetSha256"], sha256_json(target_v2))
        validate_target(target_v2, expected_path=report["targetPath"])
        validate_assignment(
            assignment_v2, target_v2, expected_path=report["assignmentPath"]
        )
        self.assertFalse((self.fixture.root / report["candidatePath"]).exists())
        self.assertFalse((self.fixture.root / report["resultPath"]).exists())
        for path, payload in source_bytes.items():
            self.assertEqual(path.read_bytes(), payload)

    def test_accepts_explicit_no_output_failure_kind(self) -> None:
        report = self.invoke(failure_kind="no-output")
        target = json.loads((self.fixture.root / report["targetPath"]).read_text())
        self.assertIsNone(target["correctionSource"])

    def test_rejects_non_no_output_failures_and_prior_candidate(self) -> None:
        _target, _assignment, _result, target_path, assignment_path, result_path = (
            self.fixture.complete_failure(failure_kind="timeout")
        )
        with self.assertRaisesRegex(ContractError, "other or no-output"):
            provider_retry.materialize_provider_retry(
                target_path,
                assignment_path,
                result_path,
                self.fixture.root,
                assigned_at="2026-09-03T07:00:00Z",
            )

        self.fixture.close()
        self.fixture = ProviderRetryFixture()
        target, _assignment, _result, target_path, assignment_path, result_path = (
            self.fixture.complete_failure()
        )
        self.fixture.write_bytes(target["output"]["candidatePath"], fake_png())
        with self.assertRaisesRegex(ContractError, "prior image-returning candidate"):
            provider_retry.materialize_provider_retry(
                target_path,
                assignment_path,
                result_path,
                self.fixture.root,
                assigned_at="2026-09-03T07:00:00Z",
            )

    def test_rejects_candidate_result(self) -> None:
        target = self.fixture.target()
        assignment, _receipt, _result = self.fixture.complete_candidate(target)
        target_path = self.fixture.root / assignment["targetPath"]
        assignment_path = self.fixture.root / assignment_path_for(
            target["waveId"], target["heroId"], target["imageKind"], 1
        )
        result_path = self.fixture.root / target["output"]["resultPath"]
        with self.assertRaisesRegex(ContractError, "failed result"):
            provider_retry.materialize_provider_retry(
                target_path,
                assignment_path,
                result_path,
                self.fixture.root,
                assigned_at="2026-09-03T07:00:00Z",
            )

    def test_rejects_dry_run_source_envelope(self) -> None:
        target = self.fixture.target()
        assignment = self.fixture.assignment(target)
        assignment["dryRun"] = True
        target_path, assignment_path = self.fixture.materialize_envelope(
            target, assignment
        )
        result = self.fixture.failed_result(target, assignment)
        result_path = self.fixture.root / target["output"]["resultPath"]
        write_result(target_path, assignment_path, result, self.fixture.root)
        with self.assertRaisesRegex(ContractError, "dry-run"):
            provider_retry.materialize_provider_retry(
                target_path,
                assignment_path,
                result_path,
                self.fixture.root,
                assigned_at="2026-09-03T07:00:00Z",
            )

    def test_collision_is_no_write(self) -> None:
        target, _assignment, _result, target_path, assignment_path, result_path = (
            self.fixture.complete_failure()
        )
        collision_relative = assignment_path_for(
            target["waveId"], target["heroId"], target["imageKind"], 2
        )
        sentinel = b"other-owner"
        self.fixture.write_bytes(collision_relative, sentinel)
        v2_target_relative = target_path_for(
            target["waveId"], target["heroId"], target["imageKind"], 2
        )
        with self.assertRaisesRegex(ContractError, "collision"):
            provider_retry.materialize_provider_retry(
                target_path,
                assignment_path,
                result_path,
                self.fixture.root,
                assigned_at="2026-09-03T07:00:00Z",
            )
        self.assertFalse((self.fixture.root / v2_target_relative).exists())
        self.assertEqual(
            (self.fixture.root / collision_relative).read_bytes(), sentinel
        )

    def test_second_create_failure_rolls_back_created_target(self) -> None:
        target, _assignment, _result, target_path, assignment_path, result_path = (
            self.fixture.complete_failure()
        )
        real_create = provider_retry.anchored_exclusive_create
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
        with patch.object(
            provider_retry, "anchored_exclusive_create", side_effect=fail_second
        ):
            with self.assertRaises(FileExistsError):
                provider_retry.materialize_provider_retry(
                    target_path,
                    assignment_path,
                    result_path,
                    self.fixture.root,
                    assigned_at="2026-09-03T07:00:00Z",
                )
        self.assertFalse((self.fixture.root / v2_target_relative).exists())


if __name__ == "__main__":
    unittest.main()
