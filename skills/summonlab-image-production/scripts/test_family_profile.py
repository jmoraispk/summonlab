#!/usr/bin/env python3
"""Contract tests for the v3 family-affinity production profile."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from render_prompt import render, render_family_prompt
from persist_family_candidate import persist_family_candidate
from anchored_io import AnchoredCreateHooks
from validate_target import run_mandatory_family_dispatch_gate, validate
from verify_result import verify_family_result
from write_family_result import exclusive_create_family_result


ROOT = "assets/enemies/experiments/family-affinity-v1"
SHA = "0" * 64


def canonical_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


class FamilyProfileTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.workspace = Path(self.temporary.name)
        self.packet_path = f"{ROOT}/families/01-goblins.json"
        self.mapping_path = f"{ROOT}/current-class-mapping.json"
        packet = {"schemaVersion": "family-packet-v1", "familyId": "goblins"}
        self._write_json(self.packet_path, packet)
        self._write_json(self.mapping_path, {"schemaVersion": "current-class-mapping-v1"})

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def _write_json(self, relative: str, value: object) -> Path:
        path = self.workspace / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(canonical_json(value), encoding="utf-8")
        return path

    def _packet_hash(self) -> str:
        packet = json.loads((self.workspace / self.packet_path).read_text(encoding="utf-8"))
        return hashlib.sha256(canonical_json(packet).encode("utf-8")).hexdigest()

    def _target(self, affinity: str = "normal", namespace: str = "canonical") -> dict:
        family = "goblins"
        form = "goblin-scout"
        current = None if namespace == "canonical" else "goblin-skirmisher"
        coordinate = (
            f"{family}/{form}/{affinity}"
            if namespace == "canonical"
            else f"{current}/{family}/{form}/{affinity}"
        )
        target_id = f"{namespace}/{coordinate}/v1"
        if namespace == "canonical":
            prefix = ""
            stem = f"{family}/{form}/{affinity}"
        else:
            prefix = "bridge/"
            stem = f"{current}/{affinity}"
        anchor: dict
        status = "planned"
        if affinity == "normal":
            anchor = {"kind": "normal-self"}
        elif namespace == "bridge" and affinity == "earth":
            normal_path = (
                "assets/enemies/experiments/affinity-expansion-v1/"
                f"candidates/{current}/normal-v1.png"
            )
            normal_bytes = b"existing normal candidate"
            normal_absolute = self.workspace / normal_path
            normal_absolute.parent.mkdir(parents=True, exist_ok=True)
            normal_absolute.write_bytes(normal_bytes)
            anchor = {
                "kind": "earth-bridge-provisional",
                "normalCandidatePath": normal_path,
                "normalCandidateSha256": hashlib.sha256(normal_bytes).hexdigest(),
            }
            status = "earth-bridge-provisional"
        else:
            normal_target_path = f"{ROOT}/targets/{family}/{form}/normal/target-v1.json"
            anchor = {
                "kind": "normal-approved-review",
                "normalCoordinateId": f"{family}/{form}/normal",
                "normalVersion": 1,
                "normalTargetPath": normal_target_path,
                "normalTargetSha256": SHA,
                "reviewReceiptPath": f"{ROOT}/review/decisions/{family}/{form}/normal/candidate-v1-review-v1.json",
                "reviewReceiptSha256": None,
                "normalCandidatePath": None,
                "normalCandidateSha256": None,
                "normalResultPath": None,
                "normalResultSha256": None,
            }
            status = "blocked-on-anchor"
        target = {
            "schemaVersion": "family-affinity-target-v1",
            "namespace": namespace,
            "coordinateId": coordinate,
            "targetId": target_id,
            "familyId": family,
            "formId": form,
            "currentClassId": current,
            "affinity": affinity,
            "tier": "T1",
            "primaryArchetype": "Scout",
            "battlefieldDuty": "Probe the flank",
            "identityInvariants": ["Green goblin", "Two arms and two legs"],
            "anatomyInvariants": ["Two arms", "Two legs"],
            "constructionDimensions": ["material", "motion"],
            "telegraph": "Raises knife",
            "counterplay": "Step aside",
            "forbiddenTreatments": ["No hue-only treatment"],
            "sources": {
                "familyPacketPath": self.packet_path,
                "familyPacketSha256": self._packet_hash(),
                "sourcePage": "docs/wiki/creatures/monster-races/goblins.md",
                "sourceReferences": ["Goblin Scout"],
                "mappingPath": self.mapping_path,
            },
            "presentationContract": {
                "framing": "full-body-readable",
                "background": "cinematic-neutral-environment",
                "featuredSubjects": 1,
                "textAllowed": False,
                "watermarkAllowed": False,
            },
            "acceptanceCriteria": [f"criterion {index}" for index in range(8)],
            "ownedPaths": {
                "candidate": f"{ROOT}/{prefix}candidates/{stem}-v1.png",
                "result": f"{ROOT}/{prefix}results/{stem}-v1.json",
                "decision": (
                    f"{ROOT}/review/decisions/{stem}/candidate-v1-review-v1.json"
                    if namespace == "canonical"
                    else f"{ROOT}/review/bridge/decisions/{stem}/candidate-v1-review-v1.json"
                ),
                "blindReview": (
                    f"{ROOT}/review/blind/{stem}/candidate-v1-blind-v1.json"
                    if namespace == "canonical"
                    else f"{ROOT}/review/bridge/blind/{stem}/candidate-v1-blind-v1.json"
                ),
            },
            "anchor": anchor,
            "precedingAttempt": None,
            "version": 1,
            "status": status,
            "promotionCeiling": "approved-review",
            "runtimeCatalogMutationForbidden": True,
        }
        if namespace == "bridge":
            target["canonicalCoordinateId"] = f"{family}/{form}/earth"
        return target

    def _paths(self, target: dict) -> tuple[str, str]:
        if target["namespace"] == "canonical":
            stem = f'{target["familyId"]}/{target["formId"]}/{target["affinity"]}'
            return (
                f"{ROOT}/targets/{stem}/target-v1.json",
                f"{ROOT}/assignments/{stem}/assignment-v1.json",
            )
        stem = f'{target["currentClassId"]}/{target["affinity"]}'
        return (
            f"{ROOT}/bridge/targets/{stem}/target-v1.json",
            f"{ROOT}/bridge/assignments/{stem}/assignment-v1.json",
        )

    def _assignment(self, target: dict) -> dict:
        target_hash = hashlib.sha256(canonical_json(target).encode("utf-8")).hexdigest()
        return {
            "schemaVersion": "family-affinity-assignment-v1",
            "assignmentId": f'{target["targetId"]}/assignment',
            "targetId": target["targetId"],
            "targetSha256": target_hash,
            "coordinateId": target["coordinateId"],
            "namespace": target["namespace"],
            "version": target["version"],
            "producerRole": "image-producer",
            "allowedOutputs": {
                "candidate": target["ownedPaths"]["candidate"],
                "result": target["ownedPaths"]["result"],
            },
            "retryCeiling": 1,
            "dispatchStatus": target["status"],
            "selfPromotionForbidden": True,
            "runtimeCatalogMutationForbidden": True,
        }

    def _persist_inputs(self, target: dict, assignment: dict) -> tuple[Path, Path]:
        target_relative, assignment_relative = self._paths(target)
        return self._write_json(target_relative, target), self._write_json(
            assignment_relative, assignment
        )

    def _family_result(
        self, target: dict, assignment: dict, candidate_bytes: bytes
    ) -> dict:
        return {
            "schemaVersion": "family-affinity-result-v1",
            "targetId": target["targetId"],
            "targetSha256": assignment["targetSha256"],
            "coordinateId": target["coordinateId"],
            "candidateVersion": 1,
            "producerId": "image-producer-01",
            "candidatePath": target["ownedPaths"]["candidate"],
            "candidateSha256": hashlib.sha256(candidate_bytes).hexdigest(),
            "resultPath": target["ownedPaths"]["result"],
            "sourcePath": self.packet_path,
            "sourceSha256": self._packet_hash(),
            "promptSha256": hashlib.sha256(
                render_family_prompt(target, assignment).encode("utf-8")
            ).hexdigest(),
            "state": "candidate-only",
            "runtimeCatalogMutationForbidden": True,
        }

    def test_family_normal_and_all_element_names_dispatch_explicitly(self) -> None:
        normal = self._target()
        assignment = self._assignment(normal)
        self._persist_inputs(normal, assignment)
        report = validate(normal, assignment, self.workspace)
        self.assertEqual(report["profile"], "image-production-family-target-v1")

        for affinity in ("fire", "earth", "water", "wind"):
            blocked = self._target(affinity)
            blocked_assignment = self._assignment(blocked)
            self._persist_inputs(blocked, blocked_assignment)
            with self.assertRaisesRegex(ValueError, "blocked-on-anchor"):
                validate(blocked, blocked_assignment, self.workspace)

    def test_self_bound_replacement_packet_and_mapping_are_dispatchable(self) -> None:
        replacement_packet_path = f"{ROOT}/family-replacements/01-goblins.json"
        replacement_packet = {
            "schemaVersion": "family-packet-v1",
            "packetPath": replacement_packet_path,
            "familyId": "goblins",
        }
        self._write_json(replacement_packet_path, replacement_packet)
        replacement_mapping_path = f"{ROOT}/mappings/current-class-mapping-v2.json"
        replacement_mapping = {
            "schemaVersion": "current-class-mapping-v1",
            "mappingPath": replacement_mapping_path,
        }
        self._write_json(replacement_mapping_path, replacement_mapping)
        target = self._target()
        target["sources"].update(
            {
                "familyPacketPath": replacement_packet_path,
                "familyPacketSha256": hashlib.sha256(
                    canonical_json(replacement_packet).encode("utf-8")
                ).hexdigest(),
                "mappingPath": replacement_mapping_path,
            }
        )
        self.assertEqual(
            validate(target, self._assignment(target), self.workspace)["status"],
            "planned",
        )

        replacement_packet["packetPath"] = f"{ROOT}/family-replacements/forged.json"
        self._write_json(replacement_packet_path, replacement_packet)
        forged_packet_target = json.loads(canonical_json(target))
        forged_packet_target["sources"]["familyPacketSha256"] = hashlib.sha256(
            canonical_json(replacement_packet).encode("utf-8")
        ).hexdigest()
        with self.assertRaisesRegex(ValueError, "packet replacement is not self-bound"):
            validate(
                forged_packet_target,
                self._assignment(forged_packet_target),
                self.workspace,
            )

        self._write_json(replacement_packet_path, {
            **replacement_packet,
            "packetPath": replacement_packet_path,
        })
        replacement_mapping["mappingPath"] = f"{ROOT}/mappings/forged.json"
        self._write_json(replacement_mapping_path, replacement_mapping)
        with self.assertRaisesRegex(ValueError, "mapping replacement is not self-bound"):
            validate(target, self._assignment(target), self.workspace)

    def test_provisional_bridge_earth_is_dispatchable_but_never_approved(self) -> None:
        target = self._target("earth", "bridge")
        assignment = self._assignment(target)
        self._persist_inputs(target, assignment)
        report = validate(target, assignment, self.workspace)
        self.assertEqual(report["status"], "earth-bridge-provisional")
        self.assertEqual(report["promotionCeiling"], "candidate-only")

        normal_path = self.workspace / target["anchor"]["normalCandidatePath"]
        normal_path.write_bytes(b"tampered normal candidate")
        with self.assertRaisesRegex(ValueError, "Normal candidate evidence is stale"):
            validate(target, assignment, self.workspace)

    def test_bridge_semantic_correction_is_hash_bound_and_explicit(self) -> None:
        target = self._target("earth", "bridge")
        target["version"] = 2
        target["targetId"] = f'bridge/{target["coordinateId"]}/v2'
        stem = f'{target["currentClassId"]}/{target["affinity"]}'
        target["ownedPaths"] = {
            "candidate": f"{ROOT}/bridge/candidates/{stem}-v2.png",
            "result": f"{ROOT}/bridge/results/{stem}-v2.json",
            "decision": (
                f"{ROOT}/review/bridge/decisions/{stem}/candidate-v2-review-v2.json"
            ),
            "blindReview": (
                f"{ROOT}/review/bridge/blind/{stem}/candidate-v2-blind-v2.json"
            ),
        }
        predecessor_sha = "1" * 64
        target["precedingAttempt"] = {
            "targetId": f'bridge/{target["coordinateId"]}/v1',
            "targetSha256": predecessor_sha,
            "candidatePath": f"{ROOT}/bridge/candidates/{stem}-v1.png",
            "candidateSha256": "2" * 64,
            "resultPath": f"{ROOT}/bridge/results/{stem}-v1.json",
            "resultSha256": "3" * 64,
            "reviewPath": (
                f"{ROOT}/review/bridge/decisions/{stem}/candidate-v1-review-v1.json"
            ),
            "reviewSha256": "4" * 64,
        }
        target["playerFacingName"] = "Wisp"
        event = {
            "schemaVersion": "family-affinity-revision-correction-v1",
            "rationale": "Record the approved player-facing identity correction.",
            "overrides": {"playerFacingName": "Wisp"},
            "appliedVersion": 2,
            "precedingTargetId": target["precedingAttempt"]["targetId"],
            "precedingTargetSha256": predecessor_sha,
        }
        target["semanticCorrection"] = {
            **event,
            "correctionSha256": hashlib.sha256(
                canonical_json(event).encode("utf-8")
            ).hexdigest(),
        }
        assignment = self._assignment(target)
        self.assertEqual(
            validate(target, assignment, self.workspace)["targetId"], target["targetId"]
        )

        unrecorded = self._target("earth", "bridge")
        unrecorded["playerFacingName"] = "Wisp"
        with self.assertRaisesRegex(ValueError, "hash-bound semantic correction"):
            validate(unrecorded, self._assignment(unrecorded), self.workspace)

        invalid_cases = [
            (
                "unknown override",
                lambda value: value["semanticCorrection"]["overrides"].__setitem__(
                    "unapprovedField", "forged"
                ),
                "unexpected fields",
            ),
            (
                "stale correction hash",
                lambda value: value["semanticCorrection"].__setitem__(
                    "correctionSha256", SHA
                ),
                "stale or forged",
            ),
            (
                "unapplied override",
                lambda value: value.__setitem__("playerFacingName", "Other Name"),
                "not applied|not recorded",
            ),
            (
                "missing predecessor provenance",
                lambda value: value.__setitem__("precedingAttempt", None),
                "immutable attempt provenance",
            ),
        ]
        for label, mutate, message in invalid_cases:
            with self.subTest(label=label):
                invalid = json.loads(canonical_json(target))
                mutate(invalid)
                with self.assertRaisesRegex(ValueError, message):
                    validate(invalid, self._assignment(invalid), self.workspace)

    def test_bridge_only_identity_packet_is_hash_bound_without_a_family_tier(self) -> None:
        target = self._target("earth", "bridge")
        target.pop("canonicalCoordinateId")
        target["familyId"] = "bridge-goblinoid-warband"
        target["formId"] = target["currentClassId"]
        target["tier"] = "bridge-only"
        target["coordinateId"] = (
            "goblin-skirmisher/bridge-goblinoid-warband/goblin-skirmisher/earth"
        )
        target["targetId"] = f'bridge/{target["coordinateId"]}/v1'
        identity_path = f"{ROOT}/bridge/identities/goblin-skirmisher.json"
        identity = {
            "schemaVersion": "bridge-identity-packet-v1",
            "currentClassId": "goblin-skirmisher",
            "bridgeFamilyId": "bridge-goblinoid-warband",
            "bridgeFormId": "goblin-skirmisher",
            "status": "bridge-only",
            "inferredTier": None,
            "runtimeCatalogMutationForbidden": True,
        }
        self._write_json(identity_path, identity)
        target["sources"] = {
            "packetKind": "bridge-identity",
            "familyPacketPath": identity_path,
            "familyPacketSha256": hashlib.sha256(
                canonical_json(identity).encode("utf-8")
            ).hexdigest(),
            "sourcePage": "docs/wiki/creatures/monsters/README.md",
            "sourceReferences": ["goblin-skirmisher"],
            "mappingPath": self.mapping_path,
        }
        assignment = self._assignment(target)
        self._persist_inputs(target, assignment)
        report = validate(target, assignment, self.workspace)
        self.assertEqual(report["status"], "earth-bridge-provisional")

        identity["bridgeFormId"] = "forged"
        self._write_json(identity_path, identity)
        with self.assertRaisesRegex(ValueError, "packet source|hash"):
            validate(target, assignment, self.workspace)

    def test_planned_elemental_requires_same_form_normal_approval_evidence(self) -> None:
        normal = self._target()
        normal_assignment = self._assignment(normal)
        self._persist_inputs(normal, normal_assignment)
        candidate_bytes = b"approved normal"
        candidate_path = self.workspace / normal["ownedPaths"]["candidate"]
        candidate_path.parent.mkdir(parents=True, exist_ok=True)
        candidate_path.write_bytes(candidate_bytes)
        result_bytes = b'{"normal":"result"}'
        result_path = self.workspace / normal["ownedPaths"]["result"]
        result_path.parent.mkdir(parents=True, exist_ok=True)
        result_path.write_bytes(result_bytes)
        normal_hash = hashlib.sha256(canonical_json(normal).encode("utf-8")).hexdigest()
        receipt = {
            "decision": "approved-review",
            "targetId": normal["targetId"],
            "targetSha256": normal_hash,
            "candidatePath": normal["ownedPaths"]["candidate"],
            "candidateSha256": hashlib.sha256(candidate_bytes).hexdigest(),
            "resultPath": normal["ownedPaths"]["result"],
            "resultSha256": hashlib.sha256(result_bytes).hexdigest(),
        }
        receipt_path = self._write_json(normal["ownedPaths"]["decision"], receipt)

        fire = self._target("fire")
        fire["status"] = "planned"
        fire["anchor"].update(
            {
                "normalTargetSha256": normal_hash,
                "reviewReceiptSha256": hashlib.sha256(receipt_path.read_bytes()).hexdigest(),
                "normalCandidatePath": normal["ownedPaths"]["candidate"],
                "normalCandidateSha256": hashlib.sha256(candidate_bytes).hexdigest(),
                "normalResultPath": normal["ownedPaths"]["result"],
                "normalResultSha256": hashlib.sha256(result_bytes).hexdigest(),
            }
        )
        assignment = self._assignment(fire)
        self._persist_inputs(fire, assignment)
        self.assertEqual(validate(fire, assignment, self.workspace)["status"], "planned")

        foreign_path = f"{ROOT}/candidates/other-family/other-form/normal-v1.png"
        foreign = self.workspace / foreign_path
        foreign.parent.mkdir(parents=True, exist_ok=True)
        foreign.write_bytes(candidate_bytes)
        fire["anchor"]["normalCandidatePath"] = foreign_path
        forged_assignment = self._assignment(fire)
        with self.assertRaisesRegex(ValueError, "same family|exact Normal|mismatched"):
            validate(fire, forged_assignment, self.workspace)

    def test_provisional_elemental_requires_exact_verified_normal_chain(self) -> None:
        normal = self._target()
        normal_assignment = self._assignment(normal)
        self._persist_inputs(normal, normal_assignment)
        candidate_bytes = b"verified normal candidate"
        candidate_path = self.workspace / normal["ownedPaths"]["candidate"]
        candidate_path.parent.mkdir(parents=True, exist_ok=True)
        candidate_path.write_bytes(candidate_bytes)
        result_bytes = b'{"verified":"normal-result"}'
        result_path = self.workspace / normal["ownedPaths"]["result"]
        result_path.parent.mkdir(parents=True, exist_ok=True)
        result_path.write_bytes(result_bytes)
        normal_hash = hashlib.sha256(canonical_json(normal).encode("utf-8")).hexdigest()

        fire = self._target("fire")
        fire["status"] = "planned-provisional-anchor"
        fire["anchor"] = {
            "kind": "normal-verified-candidate",
            "normalCoordinateId": normal["coordinateId"],
            "normalVersion": 1,
            "normalTargetPath": f"{ROOT}/targets/goblins/goblin-scout/normal/target-v1.json",
            "normalTargetSha256": normal_hash,
            "normalCandidatePath": normal["ownedPaths"]["candidate"],
            "normalCandidateSha256": hashlib.sha256(candidate_bytes).hexdigest(),
            "normalResultPath": normal["ownedPaths"]["result"],
            "normalResultSha256": hashlib.sha256(result_bytes).hexdigest(),
            "sourcePacketPath": self.packet_path,
            "sourcePacketSha256": self._packet_hash(),
            "humanReviewPending": True,
            "runtimeCatalogMutationForbidden": True,
        }
        assignment = self._assignment(fire)
        self._persist_inputs(fire, assignment)
        self.assertEqual(
            validate(fire, assignment, self.workspace)["status"],
            "planned-provisional-anchor",
        )

        fire["anchor"]["normalCandidateSha256"] = "1" * 64
        with self.assertRaisesRegex(ValueError, "candidate hash"):
            validate(fire, self._assignment(fire), self.workspace)

    def test_prompt_is_exact_stable_json_bytes_with_no_newline(self) -> None:
        target = self._target()
        assignment = self._assignment(target)
        expected = canonical_json(
            {
                "schemaVersion": "family-affinity-prompt-material-v1",
                "target": target,
                "assignment": assignment,
            }
        )
        rendered = render_family_prompt(target, assignment)
        self.assertEqual(rendered, expected)
        self.assertFalse(rendered.endswith("\n"))

    def test_family_validation_rejects_wrong_contract_and_ownership(self) -> None:
        valid = self._target()
        mutations = [
            ("schema", lambda t, a: t.__setitem__("schemaVersion", "image-production-family-target-v1")),
            ("wood", lambda t, a: t.__setitem__("affinity", "wood")),
            ("metal", lambda t, a: t.__setitem__("affinity", "metal")),
            ("root", lambda t, a: t["ownedPaths"].__setitem__("candidate", "assets/elsewhere/a-v1.png")),
            ("version", lambda t, a: t.__setitem__("version", 2)),
            ("target hash", lambda t, a: a.__setitem__("targetSha256", SHA)),
            ("retry", lambda t, a: a.__setitem__("retryCeiling", 2)),
            ("producer", lambda t, a: a.__setitem__("producerRole", "reviewer")),
            ("runtime", lambda t, a: a.__setitem__("runtimeCatalogMutationForbidden", False)),
        ]
        for label, mutate in mutations:
            with self.subTest(label=label):
                target = json.loads(canonical_json(valid))
                assignment = self._assignment(target)
                mutate(target, assignment)
                with self.assertRaises(ValueError):
                    validate(target, assignment, self.workspace)

    def test_collision_and_symlink_escape_fail_closed(self) -> None:
        target = self._target()
        assignment = self._assignment(target)
        target_path, assignment_path = self._persist_inputs(target, assignment)
        candidate = self.workspace / target["ownedPaths"]["candidate"]
        candidate.parent.mkdir(parents=True, exist_ok=True)
        candidate.write_bytes(b"collision")
        with self.assertRaisesRegex(ValueError, "collision"):
            validate(target, assignment, self.workspace)

        candidate.unlink()
        outside = Path(self.temporary.name).parent / f"outside-{os.getpid()}"
        outside.mkdir(exist_ok=True)
        candidate.parent.rmdir()
        try:
            candidate.parent.symlink_to(outside, target_is_directory=True)
            with self.assertRaisesRegex(ValueError, "symlink"):
                validate(target, assignment, self.workspace)
        finally:
            candidate.parent.unlink(missing_ok=True)
            outside.rmdir()

    def test_family_result_is_strict_and_binds_candidate_source_prompt_and_target(self) -> None:
        target = self._target()
        assignment = self._assignment(target)
        target_path, assignment_path = self._persist_inputs(target, assignment)
        candidate_bytes = b"not-real-pixels-but-hash-bound"
        candidate = self.workspace / target["ownedPaths"]["candidate"]
        candidate.parent.mkdir(parents=True, exist_ok=True)
        candidate.write_bytes(candidate_bytes)
        prompt = render_family_prompt(target, assignment)
        result = {
            "schemaVersion": "family-affinity-result-v1",
            "targetId": target["targetId"],
            "targetSha256": assignment["targetSha256"],
            "coordinateId": target["coordinateId"],
            "candidateVersion": 1,
            "producerId": "image-producer-01",
            "candidatePath": target["ownedPaths"]["candidate"],
            "candidateSha256": hashlib.sha256(candidate_bytes).hexdigest(),
            "resultPath": target["ownedPaths"]["result"],
            "sourcePath": self.packet_path,
            "sourceSha256": self._packet_hash(),
            "promptSha256": hashlib.sha256(prompt.encode("utf-8")).hexdigest(),
            "state": "candidate-only",
            "runtimeCatalogMutationForbidden": True,
        }
        result_path = self.workspace / target["ownedPaths"]["result"]
        report = verify_family_result(
            target, assignment, result, result_path, self.workspace, require_result_file=False
        )
        self.assertEqual(report["verification"], "pass")
        for field in (
            "candidateSha256",
            "sourceSha256",
            "promptSha256",
            "targetSha256",
        ):
            with self.subTest(field=field):
                forged = dict(result)
                forged[field] = SHA
                with self.assertRaises(ValueError):
                    verify_family_result(
                        target,
                        assignment,
                        forged,
                        result_path,
                        self.workspace,
                        require_result_file=False,
                    )
        verbose = dict(result)
        verbose["attempts"] = []
        with self.assertRaisesRegex(ValueError, "unexpected"):
            verify_family_result(
                target,
                assignment,
                verbose,
                result_path,
                self.workspace,
                require_result_file=False,
            )

    def test_family_result_is_exclusive_created_once_and_never_rewritten(self) -> None:
        target = self._target()
        assignment = self._assignment(target)
        target_path, assignment_path = self._persist_inputs(target, assignment)
        candidate_bytes = b"candidate"
        candidate = self.workspace / target["ownedPaths"]["candidate"]
        candidate.parent.mkdir(parents=True, exist_ok=True)
        candidate.write_bytes(candidate_bytes)
        result = self._family_result(target, assignment, candidate_bytes)
        result_path = self.workspace / target["ownedPaths"]["result"]
        with patch("write_family_result.run_mandatory_family_dispatch_gate") as gate:
            report = exclusive_create_family_result(
                target_path, assignment_path, result, self.workspace
            )
            gate.assert_called_once_with(
                target_path,
                assignment_path,
                self.workspace,
                phase="result",
                result=result,
            )
        original = result_path.read_bytes()
        self.assertEqual(report["operation"], "anchored-exclusive-create")
        self.assertEqual(original, canonical_json(result).encode("utf-8"))
        with self.assertRaisesRegex((FileExistsError, ValueError), "collision"):
            with patch("write_family_result.run_mandatory_family_dispatch_gate"):
                exclusive_create_family_result(
                    target_path, assignment_path, result, self.workspace
                )
        self.assertEqual(result_path.read_bytes(), original)

    def test_family_candidate_is_anchored_exclusive_and_retains_exact_source_bytes(self) -> None:
        target = self._target()
        assignment = self._assignment(target)
        target_path, assignment_path = self._persist_inputs(target, assignment)
        source = self.workspace / "provider-output.png"
        source_bytes = b"exact provider bytes"
        source.write_bytes(source_bytes)
        with patch(
            "persist_family_candidate.run_mandatory_family_dispatch_gate"
        ) as gate:
            report = persist_family_candidate(
                source, target_path, assignment_path, self.workspace
            )
            gate.assert_called_once_with(
                target_path, assignment_path, self.workspace, phase="candidate"
            )
        candidate = self.workspace / target["ownedPaths"]["candidate"]
        self.assertEqual(candidate.read_bytes(), source_bytes)
        self.assertEqual(report["operation"], "anchored-exclusive-copy")
        with self.assertRaisesRegex((FileExistsError, ValueError), "collision"):
            with patch("persist_family_candidate.run_mandatory_family_dispatch_gate"):
                persist_family_candidate(
                    source, target_path, assignment_path, self.workspace
                )

    def test_public_family_writers_fail_without_repository_dispatch_evidence(self) -> None:
        target = self._target()
        assignment = self._assignment(target)
        target_path, assignment_path = self._persist_inputs(target, assignment)
        source = self.workspace / "provider-output.png"
        source.write_bytes(b"candidate")
        with self.assertRaises((OSError, ValueError)):
            persist_family_candidate(
                source, target_path, assignment_path, self.workspace
            )
        self.assertFalse((self.workspace / target["ownedPaths"]["candidate"]).exists())
        candidate = self.workspace / target["ownedPaths"]["candidate"]
        candidate.parent.mkdir(parents=True, exist_ok=True)
        candidate.write_bytes(b"candidate")
        result = self._family_result(target, assignment, b"candidate")
        with self.assertRaises((OSError, ValueError)):
            exclusive_create_family_result(
                target_path, assignment_path, result, self.workspace
            )
        self.assertFalse((self.workspace / target["ownedPaths"]["result"]).exists())

    def test_fake_path_pnpm_cannot_authorize_any_public_family_writer(self) -> None:
        self._assert_executable_substitution_rejected("path-pnpm")

    def test_fake_workspace_tsx_cannot_authorize_any_public_family_writer(self) -> None:
        self._assert_executable_substitution_rejected("workspace-tsx")

    def _assert_executable_substitution_rejected(self, attack: str) -> None:
        target = self._target()
        assignment = self._assignment(target)
        target_path, assignment_path = self._persist_inputs(target, assignment)
        source = self.workspace / "provider-output.png"
        source.write_bytes(b"substitution candidate")
        dispatch_source = (
            Path(__file__).resolve().parents[3]
            / "tools/check-family-affinity-production-dispatch.ts"
        )
        workspace_dispatch = self.workspace / dispatch_source.relative_to(
            Path(__file__).resolve().parents[3]
        )
        workspace_dispatch.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(dispatch_source, workspace_dispatch)
        fake_bin = self.workspace / "fake-bin"
        fake_bin.mkdir()
        fake_program = (
            "#!/usr/bin/python3\n"
            "import json,sys\n"
            "phase=sys.argv[sys.argv.index('--phase')+1]\n"
            "print(json.dumps({'dispatchable':True,'phase':phase}))\n"
        )
        if attack == "path-pnpm":
            executable = fake_bin / "pnpm"
            executable.write_text(fake_program, encoding="utf-8")
            executable.chmod(0o755)
            attack_path = str(fake_bin)
        else:
            executable = self.workspace / "node_modules/.bin/tsx"
            executable.parent.mkdir(parents=True, exist_ok=True)
            executable.write_text(fake_program, encoding="utf-8")
            executable.chmod(0o755)
            (self.workspace / "package.json").write_text(
                '{"name":"adversarial-workspace","private":true}\n', encoding="utf-8"
            )
            attack_path = os.environ["PATH"]
        scripts = Path(__file__).resolve().parent
        base_env = {
            **os.environ,
            "PATH": attack_path,
            "PYTHONDONTWRITEBYTECODE": "1",
            "PYTHONPATH": str(scripts),
        }
        candidate = self.workspace / target["ownedPaths"]["candidate"]
        result_path = self.workspace / target["ownedPaths"]["result"]
        draft = self.workspace / "result-draft.json"

        for entrypoint in ("candidate-callable", "candidate-cli", "result-callable", "result-cli"):
            with self.subTest(attack=attack, entrypoint=entrypoint):
                candidate.unlink(missing_ok=True)
                result_path.unlink(missing_ok=True)
                if entrypoint.startswith("result"):
                    candidate.parent.mkdir(parents=True, exist_ok=True)
                    candidate.write_bytes(b"substitution candidate")
                result = self._family_result(target, assignment, b"substitution candidate")
                draft.write_text(canonical_json(result), encoding="utf-8")
                if entrypoint == "candidate-callable":
                    with patch.dict(os.environ, {"PATH": attack_path}):
                        with self.assertRaises((OSError, ValueError)):
                            persist_family_candidate(
                                source, target_path, assignment_path, self.workspace
                            )
                    self.assertFalse(candidate.exists())
                elif entrypoint == "result-callable":
                    with patch.dict(os.environ, {"PATH": attack_path}):
                        with self.assertRaises((OSError, ValueError)):
                            exclusive_create_family_result(
                                target_path,
                                assignment_path,
                                result,
                                self.workspace,
                            )
                    self.assertFalse(result_path.exists())
                else:
                    command = (
                        [
                            sys.executable,
                            str(scripts / "persist_family_candidate.py"),
                            str(source),
                            str(target_path),
                            str(assignment_path),
                            str(self.workspace),
                        ]
                        if entrypoint == "candidate-cli"
                        else [
                            sys.executable,
                            str(scripts / "write_family_result.py"),
                            str(target_path),
                            str(assignment_path),
                            str(draft),
                            str(self.workspace),
                        ]
                    )
                    completed = subprocess.run(
                        command,
                        cwd=self.workspace,
                        env=base_env,
                        capture_output=True,
                        text=True,
                        check=False,
                    )
                    self.assertNotEqual(completed.returncode, 0)
                    self.assertFalse(
                        candidate.exists()
                        if entrypoint == "candidate-cli"
                        else result_path.exists()
                    )

    def test_mandatory_gate_uses_sealed_fd_launcher_and_requires_one_json_document(
        self,
    ) -> None:
        target = self._target()
        assignment = self._assignment(target)
        target_path, assignment_path = self._persist_inputs(target, assignment)
        repository = Path(__file__).resolve().parents[3]
        entrypoint = self.workspace / "tools/check-family-affinity-production-dispatch.ts"
        entrypoint.parent.mkdir(parents=True)
        shutil.copyfile(
            repository / "tools/check-family-affinity-production-dispatch.ts", entrypoint
        )
        receipt = self.workspace / ROOT / "production-compatibility.json"
        shutil.copyfile(repository / ROOT / "production-compatibility.json", receipt)
        approval = canonical_json({"dispatchable": True, "phase": "candidate"})
        completed = subprocess.CompletedProcess([], 0, stdout=approval, stderr="")
        with patch.dict(
            os.environ,
            {
                "PATH": str(self.workspace / "fake-bin"),
                "NODE_OPTIONS": "--require=/tmp/fake-loader.cjs",
                "NODE_PATH": "/tmp/fake-node-modules",
                "LD_PRELOAD": "/tmp/fake-preload.so",
            },
        ), patch("validate_target.subprocess.run", return_value=completed) as runner:
            report = run_mandatory_family_dispatch_gate(
                target_path, assignment_path, self.workspace, phase="candidate"
            )
        self.assertTrue(report["dispatchable"])
        command = runner.call_args.args[0]
        self.assertTrue(command[0].startswith("/proc/self/fd/"))
        self.assertTrue(command[1].startswith("/proc/self/fd/"))
        self.assertNotIn("pnpm", command)
        self.assertNotIn("tsx", command)
        self.assertEqual(
            runner.call_args.kwargs["env"],
            {"LANG": "C.UTF-8", "LC_ALL": "C.UTF-8", "TZ": "UTC"},
        )
        self.assertEqual(runner.call_args.kwargs["cwd"], self.workspace)
        descriptors = runner.call_args.kwargs["pass_fds"]
        self.assertEqual(len(descriptors), 2)
        for descriptor in descriptors:
            with self.assertRaises(OSError):
                os.fstat(descriptor)
        entrypoint.write_bytes(b"drifted dispatch")
        with patch("validate_target.subprocess.run") as blocked_runner:
            with self.assertRaisesRegex(ValueError, "entrypoint drifted"):
                run_mandatory_family_dispatch_gate(
                    target_path, assignment_path, self.workspace, phase="candidate"
                )
            blocked_runner.assert_not_called()
        shutil.copyfile(
            repository / "tools/check-family-affinity-production-dispatch.ts", entrypoint
        )
        with patch(
            "validate_target.subprocess.run",
            return_value=subprocess.CompletedProcess([], 0, stdout="", stderr=""),
        ):
            with self.assertRaisesRegex(ValueError, "invalid JSON"):
                run_mandatory_family_dispatch_gate(
                    target_path,
                    assignment_path,
                    self.workspace,
                    phase="candidate",
                )

    def test_family_candidate_rejects_a_symlinked_provider_source(self) -> None:
        target = self._target()
        assignment = self._assignment(target)
        target_path, assignment_path = self._persist_inputs(target, assignment)
        real_source = self.workspace / "provider-output-real.png"
        real_source.write_bytes(b"provider bytes")
        symlink_source = self.workspace / "provider-output.png"
        symlink_source.symlink_to(real_source)
        with self.assertRaisesRegex(ValueError, "symlinked"):
            with patch("persist_family_candidate.run_mandatory_family_dispatch_gate"):
                persist_family_candidate(
                    symlink_source, target_path, assignment_path, self.workspace
                )
        self.assertFalse((self.workspace / target["ownedPaths"]["candidate"]).exists())

    def test_post_create_parent_and_final_path_swaps_fail_closed(self) -> None:
        for artifact in ("candidate", "result"):
            for mutation in ("parent", "final"):
                with self.subTest(artifact=artifact, mutation=mutation):
                    self._assert_post_create_swap_resistance(artifact, mutation)

    def _assert_post_create_swap_resistance(self, artifact: str, mutation: str) -> None:
        target = self._target()
        assignment = self._assignment(target)
        target_path, assignment_path = self._persist_inputs(target, assignment)
        candidate_bytes = b"candidate bytes"
        candidate = self.workspace / target["ownedPaths"]["candidate"]
        source = self.workspace / "provider-output.png"
        source.write_bytes(candidate_bytes)
        if artifact == "result":
            candidate.parent.mkdir(parents=True, exist_ok=True)
            candidate.write_bytes(candidate_bytes)
        result = self._family_result(target, assignment, candidate_bytes)
        owned = target["ownedPaths"][artifact]
        output = self.workspace / owned
        parent = output.parent
        parked_parent = parent.with_name(f"{parent.name}-held")
        parked_file = parent / f"{output.name}.held"
        alias_file = parent / f"{output.name}.alias"
        outside = Path(self.temporary.name).parent / (
            f"outside-post-create-{os.getpid()}-{artifact}-{mutation}"
        )
        outside.mkdir(exist_ok=True)
        sentinel = outside / "sentinel"
        sentinel.write_bytes(b"external sentinel")

        def mutate_after_create() -> None:
            if mutation == "parent":
                parent.rename(parked_parent)
                parent.symlink_to(outside, target_is_directory=True)
            else:
                os.link(output, alias_file)
                output.rename(parked_file)
                output.symlink_to(sentinel)

        try:
            with self.assertRaises(ValueError):
                if artifact == "candidate":
                    with patch("persist_family_candidate.run_mandatory_family_dispatch_gate"):
                        persist_family_candidate(
                            source,
                            target_path,
                            assignment_path,
                            self.workspace,
                            hooks=AnchoredCreateHooks(after_final_create=mutate_after_create),
                        )
                else:
                    with patch("write_family_result.run_mandatory_family_dispatch_gate"):
                        exclusive_create_family_result(
                            target_path,
                            assignment_path,
                            result,
                            self.workspace,
                            hooks=AnchoredCreateHooks(after_final_create=mutate_after_create),
                        )
            self.assertEqual(sentinel.read_bytes(), b"external sentinel")
            self.assertFalse((outside / output.name).exists())
            self.assertFalse(parked_file.exists())
            self.assertFalse(alias_file.exists())
            if parked_parent.exists():
                self.assertFalse((parked_parent / output.name).exists())
        finally:
            if parent.is_symlink():
                parent.unlink()
            if parked_parent.exists():
                parked_parent.rename(parent)
            if output.is_symlink():
                output.unlink()
            shutil.rmtree(outside)

    def test_candidate_and_result_writes_resist_parent_swap_at_all_mutation_seams(self) -> None:
        for artifact, seam in (
            ("candidate", "after_parent_anchored"),
            ("candidate", "before_final_create"),
            ("candidate", "before_cleanup"),
            ("result", "after_parent_anchored"),
            ("result", "before_final_create"),
            ("result", "before_cleanup"),
        ):
            with self.subTest(artifact=artifact, seam=seam):
                self._assert_swap_resistance(artifact, seam)

    def _assert_swap_resistance(self, artifact: str, seam: str) -> None:
        target = self._target()
        assignment = self._assignment(target)
        target_path, assignment_path = self._persist_inputs(target, assignment)
        candidate_bytes = b"candidate bytes"
        candidate = self.workspace / target["ownedPaths"]["candidate"]
        source = self.workspace / "provider-output.png"
        source.write_bytes(candidate_bytes)
        if artifact == "result":
            candidate.parent.mkdir(parents=True, exist_ok=True)
            candidate.write_bytes(candidate_bytes)
        result = self._family_result(target, assignment, candidate_bytes)
        owned = target["ownedPaths"][artifact]
        parent = (self.workspace / owned).parent
        parked = parent.with_name(f"{parent.name}-held")
        outside = Path(self.temporary.name).parent / f"outside-{os.getpid()}-{artifact}-{seam}"
        outside.mkdir(exist_ok=True)
        sentinel = outside / "sentinel"
        sentinel.write_bytes(b"external sentinel")
        swapped = False

        def swap_parent() -> None:
            nonlocal swapped
            if swapped:
                return
            parent.rename(parked)
            parent.symlink_to(outside, target_is_directory=True)
            swapped = True

        def force_post_create_failure() -> None:
            raise RuntimeError("deterministic post-create failure")

        hooks = AnchoredCreateHooks(
            after_parent_anchored=swap_parent if seam == "after_parent_anchored" else None,
            before_final_create=swap_parent if seam == "before_final_create" else None,
            after_final_create=force_post_create_failure if seam == "before_cleanup" else None,
            before_cleanup=swap_parent if seam == "before_cleanup" else None,
        )
        try:
            with self.assertRaises((ValueError, RuntimeError)):
                if artifact == "candidate":
                    with patch("persist_family_candidate.run_mandatory_family_dispatch_gate"):
                        persist_family_candidate(
                            source,
                            target_path,
                            assignment_path,
                            self.workspace,
                            hooks=hooks,
                        )
                else:
                    with patch("write_family_result.run_mandatory_family_dispatch_gate"):
                        exclusive_create_family_result(
                            target_path,
                            assignment_path,
                            result,
                            self.workspace,
                            hooks=hooks,
                        )
            self.assertEqual(sentinel.read_bytes(), b"external sentinel")
            self.assertFalse((outside / Path(owned).name).exists())
            if swapped:
                self.assertFalse((parked / Path(owned).name).exists())
        finally:
            if parent.is_symlink():
                parent.unlink()
            if parked.exists():
                parked.rename(parent)
            shutil.rmtree(outside)
        leaked = []
        for descriptor in Path("/proc/self/fd").iterdir():
            try:
                destination = descriptor.resolve()
            except FileNotFoundError:
                continue
            if str(destination).startswith(str(self.workspace)):
                leaked.append(str(destination))
        self.assertEqual(leaked, [], "anchored persistence leaked workspace file handles")


class LegacyDispatchPreservationTests(unittest.TestCase):
    def test_wood_and_metal_remain_legacy_only_in_v3_contract(self) -> None:
        skill = Path(__file__).resolve().parents[1]
        contract = json.loads(
            (skill / "references/contract-v3.json").read_text(encoding="utf-8")
        )
        profiles = contract["profiles"]
        family_affinities = profiles["image-production-family-target-v1"]["affinities"]
        legacy_affinities = profiles["legacy-affinity-v1-v2"]["affinities"]
        self.assertEqual(family_affinities, ["normal", "fire", "earth", "wind", "water"])
        self.assertIn("wood", legacy_affinities)
        self.assertIn("metal", legacy_affinities)
        self.assertNotIn("wood", family_affinities)
        self.assertNotIn("metal", family_affinities)

    def test_existing_v2_target_still_uses_legacy_validator_and_renderer(self) -> None:
        workspace = Path(__file__).resolve().parents[3]
        target_path = (
            workspace
            / "assets/enemies/experiments/affinity-expansion-v1/targets/cave-troll/water.json"
        )
        assignment_path = (
            workspace
            / "assets/enemies/experiments/affinity-expansion-v1/assignments/cave-troll/water.json"
        )
        target = json.loads(target_path.read_text(encoding="utf-8"))
        assignment = json.loads(assignment_path.read_text(encoding="utf-8"))
        report = validate(
            target, assignment, workspace, allow_existing_outputs=True
        )
        self.assertEqual(report["targetId"], target["targetId"])
        self.assertNotIn("profile", report)
        prompt = render(target)
        self.assertTrue(prompt.startswith("Use case: stylized-concept."))
        self.assertFalse(prompt.startswith("{"))


if __name__ == "__main__":
    unittest.main()
