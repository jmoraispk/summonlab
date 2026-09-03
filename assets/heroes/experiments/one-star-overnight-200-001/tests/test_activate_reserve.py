#!/usr/bin/env python3
"""Tests for append-only, quota-slot-preserving reserve activation."""

from __future__ import annotations

import json
import sys
import unittest
from copy import deepcopy
from pathlib import Path
from unittest.mock import patch


HERE = Path(__file__).resolve().parent
EXPERIMENT = HERE.parent
SCRIPTS = EXPERIMENT / "scripts"
WORKSPACE = EXPERIMENT.parents[3]
sys.path.insert(0, str(SCRIPTS))
sys.path.insert(0, str(HERE))

import activate_reserve as activation  # noqa: E402
import materialize_supplemental_reserve as supplemental  # noqa: E402
from build_review import discover_review_state, load_effective_roster  # noqa: E402
from contracts import ContractError, canonical_json, sha256_json  # noqa: E402
from persist_candidate import persist_candidate  # noqa: E402
from test_contracts import WorkspaceFixture, fake_png  # noqa: E402
from write_result import write_result  # noqa: E402


class ActivationFixture(WorkspaceFixture):
    def __init__(self) -> None:
        super().__init__()
        source_roster = json.loads((EXPERIMENT / "roster-plan.json").read_text())
        self.roster = source_roster
        self.roster_relative = (
            "assets/heroes/experiments/one-star-overnight-200-001/roster-plan.json"
        )
        self.write_json(self.roster_relative, source_roster)
        style = source_roster["styleReference"]
        self.write_bytes(style["path"], (WORKSPACE / style["path"]).read_bytes())
        for evidence in (activation.RESERVE_ANALYSIS, activation.CALIBRATION_INSPECTION):
            self.write_bytes(evidence, (WORKSPACE / evidence).read_bytes())

    def packet(self, hero_id: str) -> dict:
        return next(
            packet
            for packet in self.roster["active"] + self.roster["reserves"]
            if packet["heroId"] == hero_id
        )

    def materialize_failed_candidate(self, hero_id: str, *, status: str) -> None:
        packet = self.packet(hero_id)
        target = deepcopy(packet["summonTarget"])
        assignment = deepcopy(packet["summonAssignment"])
        self.write_json(packet["summonTargetPath"], target)
        self.write_json(packet["summonAssignmentPath"], assignment)
        provider = self.root / f"provider-{hero_id}.png"
        provider.write_bytes(fake_png())
        receipt = persist_candidate(
            provider,
            self.root / packet["summonTargetPath"],
            self.root / packet["summonAssignmentPath"],
            self.root,
            source_output_id=f"provider-{hero_id}",
        )
        failed_criterion = target["acceptanceCriteria"][0]["criterionId"]
        findings = []
        for criterion in target["acceptanceCriteria"]:
            outcome = (
                "fail"
                if status == "revise" and criterion["criterionId"] == failed_criterion
                else "pass"
            )
            findings.append(
                {
                    "criterionId": criterion["criterionId"],
                    "evaluator": "producer",
                    "outcome": outcome,
                    "observation": (
                        "Documented calibration defect."
                        if outcome == "fail"
                        else "Criterion passes known-target inspection."
                    ),
                }
            )
        attempt_id = f"{hero_id}-summon-attempt-1"
        result = {
            "schemaVersion": "hero-one-star-image-result-v1",
            "resultId": f"result-{target['targetId']}",
            "experimentId": target["experimentId"],
            "targetId": target["targetId"],
            "targetSha256": sha256_json(target),
            "assignmentId": assignment["assignmentId"],
            "assignmentSha256": sha256_json(assignment),
            "producerId": assignment["producerId"],
            "status": status,
            "attempts": [
                {
                    "attemptId": attempt_id,
                    "attemptNumber": 1,
                    "precedingAttemptId": None,
                    "conclusion": (
                        "rejected-by-producer" if status == "revise" else "accepted-by-producer"
                    ),
                    "failureKind": None,
                    "exactPrompt": target["canonicalPrompt"]["text"],
                    "promptSha256": target["canonicalPrompt"]["sha256"],
                    "referenceInputs": [
                        {"path": reference["path"], "sha256": reference["sha256"]}
                        for reference in target["references"]
                    ],
                    "requestStartedAt": "2026-09-02T12:00:00Z",
                    "generationCompletedAt": "2026-09-02T12:00:10Z",
                    "inspectionCompletedAt": "2026-09-02T12:00:12Z",
                    "generationDurationMs": 10000,
                    "inspectionDurationMs": 2000,
                    "totalWallTimeMs": 12000,
                    "sourceOutput": receipt["source"],
                    "persistence": receipt,
                    "findings": findings,
                    "retryReason": (
                        "Documented calibration defect." if status == "revise" else None
                    ),
                }
            ],
            "selectedAttemptId": attempt_id if status == "candidate" else None,
            "failedCriteria": [failed_criterion] if status == "revise" else [],
            "candidate": receipt["retained"],
            "startedAt": "2026-09-02T12:00:00Z",
            "completedAt": "2026-09-02T12:00:12Z",
            "totalWallTimeMs": 12000,
            "writtenOutputPaths": [
                target["output"]["candidatePath"],
                target["output"]["resultPath"],
            ],
            "attestations": {
                "noSharedFilesEdited": True,
                "selfPromoted": False,
                "candidateOnly": True,
            },
        }
        write_result(
            self.root / packet["summonTargetPath"],
            self.root / packet["summonAssignmentPath"],
            result,
            self.root,
        )

    def materialize_malformed_provider_failure(self, hero_id: str) -> str:
        packet = self.packet(hero_id)
        target = deepcopy(packet["summonTarget"])
        assignment = deepcopy(packet["summonAssignment"])
        self.write_json(packet["summonTargetPath"], target)
        self.write_json(packet["summonAssignmentPath"], assignment)
        failed_criterion = "manifest-fidelity"
        findings = [
            {
                "criterionId": criterion["criterionId"],
                "evaluator": "automated" if criterion["criterionId"] == failed_criterion else "producer",
                "outcome": "fail" if criterion["criterionId"] == failed_criterion else "pass",
                "observation": (
                    "Provider returned a malformed canvas, so no candidate can be retained."
                    if criterion["criterionId"] == failed_criterion
                    else "Criterion passes visual inspection."
                ),
            }
            for criterion in target["acceptanceCriteria"]
        ]
        attempt_id = f"{hero_id}-summon-attempt-1"
        result = {
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
                    "failureKind": "malformed-output",
                    "exactPrompt": target["canonicalPrompt"]["text"],
                    "promptSha256": target["canonicalPrompt"]["sha256"],
                    "referenceInputs": [
                        {"path": reference["path"], "sha256": reference["sha256"]}
                        for reference in target["references"]
                    ],
                    "requestStartedAt": "2026-09-02T12:00:00Z",
                    "generationCompletedAt": "2026-09-02T12:00:10Z",
                    "inspectionCompletedAt": "2026-09-02T12:00:12Z",
                    "generationDurationMs": 10000,
                    "inspectionDurationMs": 2000,
                    "totalWallTimeMs": 12000,
                    "sourceOutput": None,
                    "persistence": None,
                    "findings": findings,
                    "retryReason": None,
                }
            ],
            "selectedAttemptId": None,
            "failedCriteria": [failed_criterion],
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
        write_result(
            self.root / packet["summonTargetPath"],
            self.root / packet["summonAssignmentPath"],
            result,
            self.root,
        )
        return packet["summonTarget"]["output"]["resultPath"]

    def activate(self, failed: str, reserve: str) -> dict:
        return activation.activate_reserve(
            self.root / self.roster_relative,
            self.root,
            failed_active_hero_id=failed,
            reserve_hero_id=reserve,
            destination_wave="wave-01",
            producer_id="image-producer-reserve",
            assigned_at="2026-09-03T01:00:00Z",
            created_at="2026-09-03T00:59:00Z",
            reason="Documented calibration failure; activate the approved quota-matched reserve.",
        )


class ActivateReserveTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fixture = ActivationFixture()
        self.fixture.materialize_failed_candidate("fenel-esho", status="candidate")
        self.fixture.materialize_failed_candidate("yasu-coro", status="revise")

    def tearDown(self) -> None:
        self.fixture.close()

    def test_wenyn_replaces_fenel_without_mutating_frozen_packets_or_quotas(self) -> None:
        frozen_before = (self.fixture.root / self.fixture.roster_relative).read_bytes()
        failed = self.fixture.packet("fenel-esho")
        reserve = self.fixture.packet("wenyn-amarun")
        receipt = self.fixture.activate("fenel-esho", "wenyn-amarun")
        self.assertEqual(
            (self.fixture.root / self.fixture.roster_relative).read_bytes(), frozen_before
        )
        record = json.loads((self.fixture.root / receipt["activationPath"]).read_text())
        target = json.loads((self.fixture.root / receipt["targetPath"]).read_text())
        assignment = json.loads((self.fixture.root / receipt["assignmentPath"]).read_text())
        self.assertEqual(record["activeSelectedCount"], 200)
        self.assertEqual(
            canonical_json(record["activeQuotaSummary"]),
            canonical_json(self.fixture.roster["activeQuotaSummary"]),
        )
        self.assertEqual(record["slotQuotaCoordinates"], failed["quotaCoordinates"])
        self.assertEqual(record["physicalManifest"]["face"], reserve["physicalManifest"]["face"])
        self.assertEqual(
            record["physicalManifest"]["bodyConstruction"],
            failed["physicalManifest"]["bodyConstruction"],
        )
        self.assertEqual(record["physicalManifest"]["hair"], failed["physicalManifest"]["hair"])
        self.assertEqual(
            record["physicalManifest"]["wardrobe"], failed["physicalManifest"]["wardrobe"]
        )
        self.assertEqual(
            record["preservedReserveIdentity"]["characterKernel"],
            reserve["characterKernel"],
        )
        self.assertEqual(target["heroSpec"]["identity"]["displayName"], "Wenyn Amarun")
        self.assertEqual(
            record["preservedReserveIdentity"]["frozenIdentitySignature"],
            reserve["identitySignature"],
        )
        self.assertEqual(
            target["heroSpec"]["identity"]["identitySignature"],
            record["preservedReserveIdentity"]["activatedIdentitySignature"],
        )
        self.assertNotEqual(
            target["heroSpec"]["identity"]["identitySignature"],
            reserve["identitySignature"],
        )
        self.assertEqual(
            target["heroSpec"]["kernel"], reserve["summonTarget"]["heroSpec"]["kernel"]
        )
        self.assertEqual(target["heroSpec"]["physique"], failed["summonTarget"]["heroSpec"]["physique"])
        self.assertEqual(target["targetVersion"], 1)
        self.assertEqual(target["waveId"], "wave-01")
        self.assertIn("fresh base summon", target["canonicalPrompt"]["text"])
        self.assertNotIn("Fenel Esho", target["canonicalPrompt"]["text"])
        self.assertIsNone(target["correctionSource"])
        self.assertEqual([item["role"] for item in target["references"]], ["rendering-style"])
        failed_candidate = failed["summonTarget"]["output"]["candidatePath"]
        self.assertNotIn(failed_candidate, canonical_json(target))
        self.assertEqual(record["failedSlotEvidence"]["heroId"], "fenel-esho")
        self.assertEqual(assignment["targetSha256"], sha256_json(target))
        self.assertFalse((self.fixture.root / receipt["candidatePath"]).exists())
        self.assertFalse((self.fixture.root / receipt["resultPath"]).exists())

    def test_two_approved_activations_form_an_append_only_chain(self) -> None:
        first = self.fixture.activate("fenel-esho", "wenyn-amarun")
        first_bytes = (self.fixture.root / first["activationPath"]).read_bytes()
        second = self.fixture.activate("yasu-coro", "rao-esheth")
        self.assertEqual((self.fixture.root / first["activationPath"]).read_bytes(), first_bytes)
        first_record = json.loads(first_bytes)
        second_record = json.loads((self.fixture.root / second["activationPath"]).read_text())
        self.assertEqual(second_record["sequence"], 2)
        self.assertEqual(second_record["previousActivationSha256"], sha256_json(first_record))
        selected = {
            entry["slotHeroId"]: entry["selectedHeroId"]
            for entry in second_record["activeSelection"]
        }
        self.assertEqual(selected["fenel-esho"], "wenyn-amarun")
        self.assertEqual(selected["yasu-coro"], "rao-esheth")
        self.assertEqual(len(set(selected.values())), 200)
        self.assertEqual(
            canonical_json(second_record["activeQuotaSummary"]),
            canonical_json(self.fixture.roster["activeQuotaSummary"]),
        )

    def test_wrong_pair_and_reuse_are_rejected(self) -> None:
        with self.assertRaisesRegex(ContractError, "failure-result-path"):
            self.fixture.activate("fenel-esho", "rao-esheth")
        self.fixture.activate("fenel-esho", "wenyn-amarun")
        with self.assertRaisesRegex(ContractError, "already been activated"):
            self.fixture.activate("fenel-esho", "wenyn-amarun")

    def test_collision_is_no_mutation(self) -> None:
        collision = (
            "assets/heroes/experiments/one-star-overnight-200-001/"
            "waves/wave-01/targets/wenyn-amarun/summon-v1.json"
        )
        sentinel = b"another-coordinator"
        self.fixture.write_bytes(collision, sentinel)
        with self.assertRaisesRegex(ContractError, "collision"):
            self.fixture.activate("fenel-esho", "wenyn-amarun")
        self.assertEqual((self.fixture.root / collision).read_bytes(), sentinel)
        activation_root = self.fixture.root / activation.EXPERIMENT_ROOT / "activations"
        self.assertFalse(activation_root.exists())

    def test_terminal_malformed_provider_output_can_activate_a_reserve(self) -> None:
        result_path = self.fixture.materialize_malformed_provider_failure("kaar-jorar")
        receipt = activation.activate_reserve(
            self.fixture.root / self.fixture.roster_relative,
            self.fixture.root,
            failed_active_hero_id="kaar-jorar",
            reserve_hero_id="zelen-soror",
            destination_wave="wave-01",
            producer_id="image-producer-reserve",
            assigned_at="2026-09-03T01:00:00Z",
            created_at="2026-09-03T00:59:00Z",
            reason="Terminal malformed provider canvas; activate a frozen reserve.",
            failure_result_path=self.fixture.root / result_path,
        )
        record = json.loads((self.fixture.root / receipt["activationPath"]).read_text())
        self.assertEqual(record["decisionEvidence"]["failureStatus"], "failed")
        self.assertIn("provider-output integrity", record["decisionEvidence"]["authorization"])
        self.assertEqual(record["activeSelectedCount"], 200)

    def test_partial_publication_rolls_back_exact_created_inodes(self) -> None:
        real_create = activation.anchored_exclusive_create
        calls = 0

        def fail_second(workspace: Path, relative_path: str, payload: bytes):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise FileExistsError("simulated assignment publication race")
            return real_create(workspace, relative_path, payload)

        with patch.object(activation, "anchored_exclusive_create", side_effect=fail_second):
            with self.assertRaises(FileExistsError):
                self.fixture.activate("fenel-esho", "wenyn-amarun")
        target = (
            self.fixture.root
            / "assets/heroes/experiments/one-star-overnight-200-001/"
            "waves/wave-01/targets/wenyn-amarun/summon-v1.json"
        )
        self.assertFalse(target.exists())

    def test_supplemental_reserve_is_blocked_while_same_gender_frozen_reserve_remains(self) -> None:
        receipt = supplemental.materialize_supplemental_reserve(
            self.fixture.root / self.fixture.roster_relative,
            self.fixture.root,
            created_at="2026-09-03T06:10:00Z",
            reason="Test-only supplemental reserve after an exhausted same-gender pool.",
        )
        with self.assertRaisesRegex(ContractError, "unused frozen same-gender"):
            activation.activate_reserve(
                self.fixture.root / self.fixture.roster_relative,
                self.fixture.root,
                failed_active_hero_id="yasu-coro",
                reserve_hero_id=receipt["heroId"],
                destination_wave="wave-01",
                producer_id="image-producer-supplemental-test",
                assigned_at="2026-09-03T06:11:00Z",
                created_at="2026-09-03T06:10:30Z",
                reason="Test blocked until the frozen same-gender pool is exhausted.",
                failure_result_path=self.fixture.root
                / self.fixture.packet("yasu-coro")["summonTarget"]["output"]["resultPath"],
                supplemental_reserve_path=self.fixture.root / receipt["path"],
            )

    def test_supplemental_activation_preserves_chain_quota_and_review_retirement(self) -> None:
        receipt = supplemental.materialize_supplemental_reserve(
            self.fixture.root / self.fixture.roster_relative,
            self.fixture.root,
            created_at="2026-09-03T06:10:00Z",
            reason="Test-only supplemental reserve after an exhausted same-gender pool.",
        )
        failure_path = self.fixture.materialize_malformed_provider_failure("kaar-jorar")
        selection = [
            {"slotHeroId": packet["heroId"], "selectedHeroId": packet["heroId"]}
            for packet in self.fixture.roster["active"]
        ]
        used_women = {
            packet["heroId"]
            for packet in self.fixture.roster["reserves"]
            if packet["physicalManifest"]["genderPresentation"] == "woman"
        }
        with patch.object(
            activation,
            "_current_selection",
            return_value=(selection, used_women, set(), None, 0),
        ):
            activated = activation.activate_reserve(
                self.fixture.root / self.fixture.roster_relative,
                self.fixture.root,
                failed_active_hero_id="kaar-jorar",
                reserve_hero_id=receipt["heroId"],
                destination_wave="wave-01",
                producer_id="image-producer-supplemental-test",
                assigned_at="2026-09-03T06:11:00Z",
                created_at="2026-09-03T06:10:30Z",
                reason="Frozen woman reserve pool exhausted; activate the hash-bound supplement.",
                failure_result_path=self.fixture.root / failure_path,
                supplemental_reserve_path=self.fixture.root / receipt["path"],
            )
        record = json.loads((self.fixture.root / activated["activationPath"]).read_text())
        source_record = json.loads((self.fixture.root / receipt["path"]).read_text())
        self.assertEqual(record["sequence"], 1)
        self.assertIsNone(record["previousActivationSha256"])
        self.assertEqual(record["decisionEvidence"]["supplementalReservePath"], receipt["path"])
        self.assertEqual(
            record["decisionEvidence"]["supplementalReserveSha256"], sha256_json(source_record)
        )
        self.assertEqual(
            record["decisionEvidence"]["supplementalReservePacketSha256"],
            sha256_json(source_record["reservePacket"]),
        )
        self.assertEqual(record["activeQuotaSummary"], self.fixture.roster["activeQuotaSummary"])
        effective, summary = load_effective_roster(self.fixture.root)
        self.assertEqual(len(effective), 200)
        self.assertEqual(len({packet["heroId"] for packet in effective}), 200)
        self.assertIn(receipt["heroId"], {packet["heroId"] for packet in effective})
        self.assertEqual(summary["count"], 1)
        _roster, _acts, _artifacts, _pairs, quarantine = discover_review_state(self.fixture.root)
        retired = next(item for item in quarantine if item.roster["heroId"] == "kaar-jorar")
        self.assertIn("replaced by reserve", retired.reasons[0])

        current_selection = [
            {
                "slotHeroId": entry["slotHeroId"],
                "selectedHeroId": (
                    receipt["heroId"]
                    if entry["slotHeroId"] == "kaar-jorar"
                    else entry["selectedHeroId"]
                ),
            }
            for entry in selection
        ]
        with patch.object(
            activation,
            "_current_selection",
            return_value=(
                current_selection,
                used_women | {receipt["heroId"]},
                {"kaar-jorar"},
                sha256_json(record),
                1,
            ),
        ):
            with self.assertRaisesRegex(ContractError, "duplicates or reuses|already been activated"):
                activation.activate_reserve(
                    self.fixture.root / self.fixture.roster_relative,
                    self.fixture.root,
                    failed_active_hero_id="kaar-jorar",
                    reserve_hero_id=receipt["heroId"],
                    destination_wave="wave-01",
                    producer_id="image-producer-supplemental-test",
                    assigned_at="2026-09-03T06:12:00Z",
                    created_at="2026-09-03T06:11:30Z",
                    reason="Reuse must fail.",
                    failure_result_path=self.fixture.root / failure_path,
                    supplemental_reserve_path=self.fixture.root / receipt["path"],
                )
        record["decisionEvidence"]["supplementalReserveSha256"] = "f" * 64
        self.fixture.write_json(activated["activationPath"], record)
        with self.assertRaisesRegex(ContractError, "does not bind its supplemental reserve"):
            activation._current_selection(self.fixture.root, self.fixture.roster)

    def test_supplemental_activation_rejects_gender_mismatch(self) -> None:
        receipt = supplemental.materialize_supplemental_reserve(
            self.fixture.root / self.fixture.roster_relative,
            self.fixture.root,
            created_at="2026-09-03T06:10:00Z",
            reason="Test-only supplemental woman reserve.",
        )
        failed_man = next(
            packet
            for packet in self.fixture.roster["active"]
            if packet["physicalManifest"]["genderPresentation"] == "man"
            and packet["heroId"] not in {"fenel-esho", "yasu-coro"}
        )
        failure_path = self.fixture.materialize_malformed_provider_failure(failed_man["heroId"])
        selection = [
            {"slotHeroId": packet["heroId"], "selectedHeroId": packet["heroId"]}
            for packet in self.fixture.roster["active"]
        ]
        used_men = {
            packet["heroId"]
            for packet in self.fixture.roster["reserves"]
            if packet["physicalManifest"]["genderPresentation"] == "man"
        }
        with patch.object(
            activation,
            "_current_selection",
            return_value=(selection, used_men, set(), None, 0),
        ):
            with self.assertRaisesRegex(ContractError, "preserve gender presentation"):
                activation.activate_reserve(
                    self.fixture.root / self.fixture.roster_relative,
                    self.fixture.root,
                    failed_active_hero_id=failed_man["heroId"],
                    reserve_hero_id=receipt["heroId"],
                    destination_wave="wave-01",
                    producer_id="image-producer-supplemental-test",
                    assigned_at="2026-09-03T06:11:00Z",
                    created_at="2026-09-03T06:10:30Z",
                    reason="Gender mismatch must fail.",
                    failure_result_path=self.fixture.root / failure_path,
                    supplemental_reserve_path=self.fixture.root / receipt["path"],
                )


if __name__ == "__main__":
    unittest.main()
