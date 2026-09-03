#!/usr/bin/env python3
"""Unit coverage for the Heroes-local one-image production envelope."""

from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path


HERE = Path(__file__).resolve().parent
SCRIPTS = HERE.parent / "scripts"
sys.path.insert(0, str(SCRIPTS))

from contracts import (  # noqa: E402
    ContractError,
    EXPERIMENT_ROOT,
    REQUIRED_FORBIDDEN_PATHS,
    assignment_path_for,
    candidate_path_for,
    canonical_json,
    result_path_for,
    sha256_bytes,
    sha256_json,
    target_path_for,
    validate_assignment,
    validate_result,
    validate_target,
)
from persist_candidate import persist_candidate  # noqa: E402
from validate_experiment import validate_experiment  # noqa: E402
from validate_preflight import validate_preflight  # noqa: E402
from validate_wave import validate_wave  # noqa: E402
from write_result import write_result  # noqa: E402


def fake_png(width: int = 1024, height: int = 1536) -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n"
        + (13).to_bytes(4, "big")
        + b"IHDR"
        + width.to_bytes(4, "big")
        + height.to_bytes(4, "big")
        + b"\x08\x02\x00\x00\x00"
        + b"placeholder-pixels"
    )


def hero_spec(name: str = "Ari Test") -> dict:
    return {
        "identity": {
            "displayName": name,
            "gender": "woman",
            "age": 27,
            "skinValueBand": 4,
            "faceDescription": "Broad cheeks, level brow, and a small chin scar.",
            "identitySignature": f"{name} copper crop and repaired wrap",
        },
        "physique": {
            "bodyType": "athletic-conditioned",
            "heightBand": "medium",
            "description": "Conditioned runner build with modest arms and strong legs.",
        },
        "hair": {
            "colorFamily": "red-copper-auburn",
            "silhouetteFamily": "short-textured-crop",
            "accent": "one offset shaved line",
            "chibiReadability": "Keep the copper crop and offset shaved line readable.",
        },
        "wardrobe": {
            "family": "layered-wrap",
            "paletteFamily": "ochre-cream",
            "description": "Ochre cross-wrap over cream trousers with a repaired hem.",
            "condition": "Carefully maintained with one visible repair.",
        },
        "details": {
            "density": 1,
            "tattooScope": "none",
            "anchors": ["hammered copper ear cuff"],
            "coolnessAnchor": "repairs-patina-keepsake",
        },
        "kernel": {
            "dominantTrait": "Exacting",
            "counterTrait": "Impulsive around dares",
            "tension": "Maintains perfect order but accepts foolish challenges.",
            "socialPresentation": "Attentive and blunt",
            "groomingAttitude": "Immaculate except during work",
            "colorOrnamentTaste": "Warm color confidence with one ornament",
            "culturalFragments": ["double-folded hems", "tea offered with both hands"],
            "lifeEcho": "Textile repair",
            "poseCue": "One hand checks a repaired seam",
            "nonInference": "Do not infer aptitude, morality, or intelligence from appearance.",
        },
    }


class WorkspaceFixture:
    def __init__(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.style_relative = "assets/heroes/style-fixture.png"
        self.style_bytes = b"style-reference"
        self.write_bytes(self.style_relative, self.style_bytes)

    def close(self) -> None:
        self.temporary.cleanup()

    def write_bytes(self, relative: str, payload: bytes) -> None:
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(payload)

    def write_json(self, relative: str, value: object) -> None:
        self.write_bytes(relative, (json.dumps(value, indent=2) + "\n").encode())

    def target(
        self,
        *,
        hero_id: str = "ari-test",
        kind: str = "summon",
        version: int = 1,
        source_summon: dict | None = None,
        correction_source: dict | None = None,
    ) -> dict:
        prompt = f"Create one immutable {kind} candidate for {hero_id} version {version}."
        references = [
            {
                "path": self.style_relative,
                "sha256": sha256_bytes(self.style_bytes),
                "purpose": "Rendering register only; do not copy identity.",
                "role": "rendering-style",
            }
        ]
        if kind == "combat-chibi" and source_summon is not None:
            references = [
                {
                    "path": source_summon["candidatePath"],
                    "sha256": source_summon["sha256"],
                    "purpose": "Sole identity, anatomy, hair, wardrobe, and marking authority.",
                    "role": "identity-anatomy-authority",
                }
            ]
        if version > 1 and correction_source is not None:
            references.append(
                {
                    "path": correction_source["candidatePath"],
                    "sha256": correction_source["sha256"],
                    "purpose": "Exact preceding image; correct only the declared defect.",
                    "role": "correction-source",
                }
            )
        return {
            "schemaVersion": "hero-one-star-image-target-v1",
            "targetId": f"overnight-{hero_id}-{kind}-v{version}",
            "targetVersion": version,
            "experimentId": "one-star-overnight-200-001",
            "waveId": "wave-01",
            "heroId": hero_id,
            "imageKind": kind,
            "starLevel": 1,
            "productionState": "candidate-only",
            "heroSpec": hero_spec(),
            "references": references,
            "canonicalPrompt": {"text": prompt, "sha256": sha256_bytes(prompt.encode())},
            "presentation": {
                "width": 1024,
                "height": 1536,
                "mediaType": "image/png",
                "composition": "One full-body weaponless adult with all extremities visible.",
                "negativeConstraints": ["No text, frame, stars, weapon, magic, or extra person."],
            },
            "acceptanceCriteria": [
                {
                    "criterionId": "complete-image",
                    "description": "The full subject and canvas are complete.",
                    "required": True,
                }
            ],
            "sourceSummon": source_summon,
            "correctionSource": correction_source,
            "output": {
                "candidatePath": candidate_path_for("wave-01", hero_id, kind, version),
                "resultPath": result_path_for("wave-01", hero_id, kind, version),
            },
        }

    def assignment(self, target: dict) -> dict:
        return {
            "schemaVersion": "hero-one-star-image-assignment-v1",
            "assignmentId": f"assignment-{target['targetId']}",
            "experimentId": "one-star-overnight-200-001",
            "targetId": target["targetId"],
            "targetPath": target_path_for(
                target["waveId"], target["heroId"], target["imageKind"], target["targetVersion"]
            ),
            "targetSha256": sha256_json(target),
            "producerId": "producer-test",
            "assignedAt": "2026-09-02T12:00:00Z",
            "dryRun": False,
            "retryCeiling": 1,
            "permittedOutputs": target["output"],
            "forbiddenSharedPaths": sorted(REQUIRED_FORBIDDEN_PATHS),
            "completionContract": {
                "oneTargetOneImage": True,
                "structuredResultRequired": True,
                "sharedFilesMustRemainUntouched": True,
                "candidateOnly": True,
                "selfPromotionForbidden": True,
            },
        }

    def materialize_envelope(self, target: dict, assignment: dict) -> tuple[Path, Path]:
        target_relative = assignment["targetPath"]
        assignment_relative = assignment_path_for(
            target["waveId"], target["heroId"], target["imageKind"], target["targetVersion"]
        )
        self.write_json(target_relative, target)
        self.write_json(assignment_relative, assignment)
        return self.root / target_relative, self.root / assignment_relative

    def candidate_result(self, target: dict, assignment: dict, receipt: dict) -> dict:
        attempt_id = f"{target['heroId']}-{target['imageKind']}-attempt-1"
        return {
            "schemaVersion": "hero-one-star-image-result-v1",
            "resultId": f"result-{target['targetId']}",
            "experimentId": "one-star-overnight-200-001",
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
                        {"path": ref["path"], "sha256": ref["sha256"]}
                        for ref in target["references"]
                    ],
                    "requestStartedAt": "2026-09-02T12:00:00Z",
                    "generationCompletedAt": "2026-09-02T12:00:10Z",
                    "inspectionCompletedAt": "2026-09-02T12:00:12Z",
                    "generationDurationMs": 10000,
                    "inspectionDurationMs": 2000,
                    "totalWallTimeMs": 12000,
                    "sourceOutput": receipt["source"],
                    "persistence": receipt,
                    "findings": [
                        {
                            "criterionId": "complete-image",
                            "evaluator": "producer",
                            "outcome": "pass",
                            "observation": "One complete subject is safely framed.",
                        }
                    ],
                    "retryReason": None,
                }
            ],
            "selectedAttemptId": attempt_id,
            "failedCriteria": [],
            "candidate": receipt["retained"],
            "startedAt": "2026-09-02T12:00:00Z",
            "completedAt": "2026-09-02T12:00:12Z",
            "totalWallTimeMs": 12000,
            "writtenOutputPaths": [target["output"]["candidatePath"], target["output"]["resultPath"]],
            "attestations": {"noSharedFilesEdited": True, "selfPromoted": False, "candidateOnly": True},
        }

    def complete_candidate(self, target: dict) -> tuple[dict, dict, dict]:
        assignment = self.assignment(target)
        target_path, assignment_path = self.materialize_envelope(target, assignment)
        source = self.root / f"provider-{target['heroId']}-{target['imageKind']}-v{target['targetVersion']}.png"
        source.write_bytes(fake_png())
        receipt = persist_candidate(
            source, target_path, assignment_path, self.root, source_output_id=source.name
        )
        result = self.candidate_result(target, assignment, receipt)
        write_result(target_path, assignment_path, result, self.root)
        return assignment, receipt, result


class ContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fixture = WorkspaceFixture()

    def tearDown(self) -> None:
        self.fixture.close()

    def test_canonical_hash_is_key_order_independent_and_contract_is_strict(self) -> None:
        target = self.fixture.target()
        reordered = {key: target[key] for key in reversed(target)}
        self.assertEqual(sha256_json(target), sha256_json(reordered))
        invalid = deepcopy(target)
        invalid["surprise"] = True
        with self.assertRaisesRegex(ContractError, "unknown fields"):
            validate_target(invalid)

    def test_assignment_cross_binds_target_and_paths(self) -> None:
        target = self.fixture.target()
        assignment = self.fixture.assignment(target)
        validate_assignment(assignment, target)
        assignment["targetSha256"] = "0" * 64
        with self.assertRaisesRegex(ContractError, "targetSha256"):
            validate_assignment(assignment, target)

    def test_preflight_rejects_stale_reference_and_traversal(self) -> None:
        target = self.fixture.target()
        assignment = self.fixture.assignment(target)
        target_path, assignment_path = self.fixture.materialize_envelope(target, assignment)
        validate_preflight(target_path, assignment_path, self.fixture.root)
        self.fixture.write_bytes(self.fixture.style_relative, b"changed")
        with self.assertRaisesRegex(ContractError, "reference hash mismatch"):
            validate_preflight(target_path, assignment_path, self.fixture.root)
        target["output"]["candidatePath"] = f"{EXPERIMENT_ROOT}/../escape.png"
        with self.assertRaises(ContractError):
            validate_target(target)

    def test_exact_persistence_is_exclusive_and_rejects_wrong_dimensions(self) -> None:
        target = self.fixture.target()
        assignment = self.fixture.assignment(target)
        target_path, assignment_path = self.fixture.materialize_envelope(target, assignment)
        source = self.fixture.root / "provider.png"
        source.write_bytes(fake_png())
        receipt = persist_candidate(
            source, target_path, assignment_path, self.fixture.root, source_output_id="provider-1"
        )
        self.assertEqual(receipt["source"]["sha256"], receipt["retained"]["sha256"])
        self.assertEqual(
            (self.fixture.root / target["output"]["candidatePath"]).read_bytes(), source.read_bytes()
        )
        with self.assertRaisesRegex(ContractError, "collision"):
            persist_candidate(
                source, target_path, assignment_path, self.fixture.root, source_output_id="provider-2"
            )

        other = self.fixture.target(hero_id="wrong-size")
        other_assignment = self.fixture.assignment(other)
        other_target_path, other_assignment_path = self.fixture.materialize_envelope(other, other_assignment)
        wrong = self.fixture.root / "wrong.png"
        wrong.write_bytes(fake_png(1000, 1000))
        with self.assertRaisesRegex(ContractError, "1024x1536"):
            persist_candidate(
                wrong,
                other_target_path,
                other_assignment_path,
                self.fixture.root,
                source_output_id="wrong",
            )

    def test_symlinked_parent_and_source_fail_closed(self) -> None:
        target = self.fixture.target()
        assignment = self.fixture.assignment(target)
        target_path, assignment_path = self.fixture.materialize_envelope(target, assignment)
        source_real = self.fixture.root / "real.png"
        source_real.write_bytes(fake_png())
        source_link = self.fixture.root / "linked.png"
        source_link.symlink_to(source_real)
        with self.assertRaises(OSError):
            persist_candidate(
                source_link,
                target_path,
                assignment_path,
                self.fixture.root,
                source_output_id="linked",
            )

        outside = self.fixture.root / "outside"
        outside.mkdir()
        candidate_parent = self.fixture.root / EXPERIMENT_ROOT / "waves/wave-01/candidates/ari-test"
        candidate_parent.parent.mkdir(parents=True, exist_ok=True)
        candidate_parent.symlink_to(outside, target_is_directory=True)
        with self.assertRaisesRegex(ContractError, "symbolic link"):
            validate_preflight(target_path, assignment_path, self.fixture.root)
        self.assertEqual(list(outside.iterdir()), [])

    def test_result_is_hash_bound_and_exclusive(self) -> None:
        target = self.fixture.target()
        assignment = self.fixture.assignment(target)
        target_path, assignment_path = self.fixture.materialize_envelope(target, assignment)
        source = self.fixture.root / "provider.png"
        source.write_bytes(fake_png())
        receipt = persist_candidate(
            source, target_path, assignment_path, self.fixture.root, source_output_id="provider"
        )
        result = self.fixture.candidate_result(target, assignment, receipt)
        validate_result(result, target, assignment)
        report = write_result(target_path, assignment_path, result, self.fixture.root)
        self.assertEqual(report["operation"], "anchored-exclusive-create")
        with self.assertRaisesRegex(ContractError, "collision"):
            write_result(target_path, assignment_path, result, self.fixture.root)

    def test_visual_retry_in_one_assignment_is_forbidden(self) -> None:
        target = self.fixture.target()
        assignment = self.fixture.assignment(target)
        source = {
            "outputId": "one",
            "path": "/tmp/one.png",
            "mediaType": "image/png",
            "width": 1024,
            "height": 1536,
            "bytes": 12,
            "sha256": "a" * 64,
        }
        retained = {key: value for key, value in source.items() if key != "outputId"}
        retained["path"] = target["output"]["candidatePath"]
        attempt = {
            "attemptId": "attempt-one",
            "attemptNumber": 1,
            "precedingAttemptId": None,
            "conclusion": "rejected-by-producer",
            "failureKind": None,
            "exactPrompt": target["canonicalPrompt"]["text"],
            "promptSha256": target["canonicalPrompt"]["sha256"],
            "referenceInputs": [{"path": ref["path"], "sha256": ref["sha256"]} for ref in target["references"]],
            "requestStartedAt": "a", "generationCompletedAt": "b", "inspectionCompletedAt": "c",
            "generationDurationMs": 1, "inspectionDurationMs": 1, "totalWallTimeMs": 2,
            "sourceOutput": source,
            "persistence": {"operation": "anchored-exclusive-copy", "source": source, "retained": retained},
            "findings": [{"criterionId": "complete-image", "evaluator": "producer", "outcome": "fail", "observation": "Needs correction."}],
            "retryReason": "Needs correction.",
        }
        second = deepcopy(attempt)
        second.update({"attemptId": "attempt-two", "attemptNumber": 2, "precedingAttemptId": "attempt-one"})
        result = {
            "schemaVersion": "hero-one-star-image-result-v1", "resultId": "result-test",
            "experimentId": "one-star-overnight-200-001", "targetId": target["targetId"],
            "targetSha256": sha256_json(target), "assignmentId": assignment["assignmentId"],
            "assignmentSha256": sha256_json(assignment), "producerId": assignment["producerId"],
            "status": "revise", "attempts": [attempt, second], "selectedAttemptId": None,
            "failedCriteria": ["complete-image"], "candidate": retained,
            "startedAt": "a", "completedAt": "c", "totalWallTimeMs": 2,
            "writtenOutputPaths": [target["output"]["candidatePath"], target["output"]["resultPath"]],
            "attestations": {"noSharedFilesEdited": True, "selfPromoted": False, "candidateOnly": True},
        }
        with self.assertRaisesRegex(ContractError, "at most one image"):
            validate_result(result, target, assignment)

    def test_versioned_target_supports_provider_retry_or_exact_correction(self) -> None:
        provider_retry = self.fixture.target(version=2)
        validate_target(provider_retry)

        invalid_later_retry = self.fixture.target(version=3)
        with self.assertRaisesRegex(ContractError, "v2 provider retry"):
            validate_target(invalid_later_retry)

        invalid_correction = deepcopy(provider_retry)
        invalid_correction["correctionSource"] = {
            "targetId": "overnight-ari-test-summon-v1",
            "resultPath": result_path_for("wave-01", "ari-test", "summon", 1),
            "candidatePath": candidate_path_for("wave-01", "ari-test", "summon", 1),
            "sha256": "a" * 64,
        }
        with self.assertRaisesRegex(ContractError, "exact preceding candidate"):
            validate_target(invalid_correction)

    def test_one_pair_wave_binds_chibi_to_selected_summon(self) -> None:
        summon = self.fixture.target()
        _assignment, _receipt, summon_result = self.fixture.complete_candidate(summon)
        source = {
            "targetId": summon["targetId"],
            "resultPath": summon["output"]["resultPath"],
            "candidatePath": summon["output"]["candidatePath"],
            "sha256": summon_result["candidate"]["sha256"],
        }
        chibi = self.fixture.target(kind="combat-chibi", source_summon=source)
        self.fixture.complete_candidate(chibi)
        report = validate_wave(self.fixture.root, "wave-01", expected_pairs=1)
        self.assertEqual(report["completePairCount"], 1)

    def test_chibi_preflight_rejects_stale_summon_hash(self) -> None:
        summon = self.fixture.target()
        self.fixture.complete_candidate(summon)
        source = {
            "targetId": summon["targetId"],
            "resultPath": summon["output"]["resultPath"],
            "candidatePath": summon["output"]["candidatePath"],
            "sha256": "0" * 64,
        }
        chibi = self.fixture.target(kind="combat-chibi", source_summon=source)
        assignment = self.fixture.assignment(chibi)
        target_path, assignment_path = self.fixture.materialize_envelope(chibi, assignment)
        with self.assertRaisesRegex(ContractError, "(?:reference|source candidate) hash mismatch"):
            validate_preflight(target_path, assignment_path, self.fixture.root)

    def test_one_no_output_provider_retry_is_allowed(self) -> None:
        target = self.fixture.target()
        assignment = self.fixture.assignment(target)
        target_path, assignment_path = self.fixture.materialize_envelope(target, assignment)
        source = self.fixture.root / "retry-success.png"
        source.write_bytes(fake_png())
        receipt = persist_candidate(
            source,
            target_path,
            assignment_path,
            self.fixture.root,
            source_output_id="retry-success",
        )
        result = self.fixture.candidate_result(target, assignment, receipt)
        accepted = result["attempts"][0]
        provider_failure = deepcopy(accepted)
        provider_failure.update(
            {
                "attemptId": "provider-failure-one",
                "conclusion": "provider-failure",
                "failureKind": "timeout",
                "sourceOutput": None,
                "persistence": None,
                "findings": [
                    {
                        "criterionId": "complete-image",
                        "evaluator": "producer",
                        "outcome": "not-applicable",
                        "observation": "Provider returned no image before timeout.",
                    }
                ],
            }
        )
        accepted["attemptNumber"] = 2
        accepted["precedingAttemptId"] = "provider-failure-one"
        result["attempts"] = [provider_failure, accepted]
        result["selectedAttemptId"] = accepted["attemptId"]
        validate_result(result, target, assignment)

    def test_final_validator_rejects_incomplete_experiment(self) -> None:
        with self.assertRaisesRegex(ContractError, "wave-01 requires 20"):
            validate_experiment(self.fixture.root)


if __name__ == "__main__":
    unittest.main()
