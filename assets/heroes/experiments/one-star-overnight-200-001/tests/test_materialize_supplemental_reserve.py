#!/usr/bin/env python3
"""Tests for deterministic, append-only supplemental reserve materialization."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path


HERE = Path(__file__).resolve().parent
EXPERIMENT = HERE.parent
SCRIPTS = EXPERIMENT / "scripts"
WORKSPACE = EXPERIMENT.parents[3]
sys.path.insert(0, str(SCRIPTS))
sys.path.insert(0, str(HERE))

import materialize_supplemental_reserve as supplemental  # noqa: E402
from contracts import ContractError, sha256_json  # noqa: E402
from test_contracts import WorkspaceFixture  # noqa: E402


class SupplementalFixture(WorkspaceFixture):
    def __init__(self) -> None:
        super().__init__()
        self.roster_relative = supplemental.ROSTER_PATH
        self.roster = json.loads((EXPERIMENT / "roster-plan.json").read_text())
        self.write_json(self.roster_relative, self.roster)
        style = self.roster["styleReference"]
        self.write_bytes(style["path"], (WORKSPACE / style["path"]).read_bytes())

    def materialize(self) -> dict:
        return supplemental.materialize_supplemental_reserve(
            self.root / self.roster_relative,
            self.root,
            created_at="2026-09-03T06:10:00Z",
            reason="The frozen woman reserve pool is exhausted; freeze one recovery identity.",
        )


class SupplementalReserveTests(unittest.TestCase):
    def test_materializes_only_one_deterministic_female_record(self) -> None:
        first = SupplementalFixture()
        second = SupplementalFixture()
        try:
            frozen_before = (first.root / first.roster_relative).read_bytes()
            one = first.materialize()
            two = second.materialize()
            self.assertEqual(one["gender"], "woman")
            self.assertEqual(one["heroId"], two["heroId"])
            self.assertEqual(
                (first.root / one["path"]).read_bytes(),
                (second.root / two["path"]).read_bytes(),
            )
            self.assertEqual((first.root / first.roster_relative).read_bytes(), frozen_before)
            record = json.loads((first.root / one["path"]).read_text())
            packet = record["reservePacket"]
            self.assertEqual(record["contentSha256"], sha256_json({
                key: value for key, value in record.items() if key != "contentSha256"
            }))
            self.assertEqual(len(supplemental.load_supplemental_reserves(first.root, first.roster)), 1)
            for relative in packet["pathPlan"].values():
                self.assertFalse((first.root / relative).exists())
            self.assertFalse(one["targetCreated"])
            self.assertFalse(one["resultCreated"])
        finally:
            first.close()
            second.close()

    def test_content_hash_drift_is_rejected(self) -> None:
        fixture = SupplementalFixture()
        try:
            receipt = fixture.materialize()
            record = json.loads((fixture.root / receipt["path"]).read_text())
            record["reason"] = "tampered after freezing"
            fixture.write_json(receipt["path"], record)
            with self.assertRaisesRegex(ContractError, "content hash drifted"):
                supplemental.load_supplemental_reserves(fixture.root, fixture.roster)
        finally:
            fixture.close()

    def test_duplicate_frozen_signature_is_rejected_even_when_rehashed(self) -> None:
        fixture = SupplementalFixture()
        try:
            receipt = fixture.materialize()
            record = json.loads((fixture.root / receipt["path"]).read_text())
            packet = record["reservePacket"]
            duplicate = fixture.roster["active"][0]["identitySignature"]
            packet["identitySignature"] = duplicate
            packet["summonTarget"]["heroSpec"]["identity"]["identitySignature"] = duplicate
            packet["summonAssignment"]["targetSha256"] = sha256_json(packet["summonTarget"])
            record["contentSha256"] = sha256_json(
                {key: value for key, value in record.items() if key != "contentSha256"}
            )
            fixture.write_json(receipt["path"], record)
            with self.assertRaisesRegex(ContractError, "duplicates a frozen"):
                supplemental.load_supplemental_reserves(fixture.root, fixture.roster)
        finally:
            fixture.close()

    def test_gender_and_rendering_reference_drift_are_rejected(self) -> None:
        fixture = SupplementalFixture()
        try:
            receipt = fixture.materialize()
            original = json.loads((fixture.root / receipt["path"]).read_text())
            record = json.loads(json.dumps(original))
            record["reservePacket"]["physicalManifest"]["genderPresentation"] = "man"
            record["contentSha256"] = sha256_json(
                {key: value for key, value in record.items() if key != "contentSha256"}
            )
            fixture.write_json(receipt["path"], record)
            with self.assertRaisesRegex(ContractError, "gender quota coordinate"):
                supplemental.load_supplemental_reserves(fixture.root, fixture.roster)

            fixture.write_json(receipt["path"], original)
            record = json.loads(json.dumps(original))
            record["styleReference"]["sha256"] = "f" * 64
            record["contentSha256"] = sha256_json(
                {key: value for key, value in record.items() if key != "contentSha256"}
            )
            fixture.write_json(receipt["path"], record)
            with self.assertRaisesRegex(ContractError, "style reference differs"):
                supplemental.load_supplemental_reserves(fixture.root, fixture.roster)
        finally:
            fixture.close()

    def test_second_record_is_append_only_and_collision_safe(self) -> None:
        fixture = SupplementalFixture()
        try:
            first = fixture.materialize()
            first_bytes = (fixture.root / first["path"]).read_bytes()
            second = supplemental.materialize_supplemental_reserve(
                fixture.root / fixture.roster_relative,
                fixture.root,
                created_at="2026-09-03T06:20:00Z",
                reason="Freeze a second deterministic recovery identity.",
            )
            self.assertNotEqual(first["heroId"], second["heroId"])
            self.assertEqual((fixture.root / first["path"]).read_bytes(), first_bytes)
            loaded = supplemental.load_supplemental_reserves(fixture.root, fixture.roster)
            self.assertEqual([record["sequence"] for _path, record in loaded], [1, 2])
        finally:
            fixture.close()

    def test_materializes_requested_man_identity(self) -> None:
        fixture = SupplementalFixture()
        try:
            receipt = supplemental.materialize_supplemental_reserve(
                fixture.root / fixture.roster_relative,
                fixture.root,
                created_at="2026-09-03T06:30:00Z",
                reason="The frozen man reserve pool is exhausted; freeze one recovery identity.",
                gender="man",
            )
            self.assertEqual(receipt["gender"], "man")
            record = json.loads((fixture.root / receipt["path"]).read_text())
            packet = record["reservePacket"]
            self.assertEqual(packet["physicalManifest"]["genderPresentation"], "man")
            self.assertEqual(packet["quotaCoordinates"]["gender"], "man")
            self.assertEqual(len(supplemental.load_supplemental_reserves(fixture.root, fixture.roster)), 1)
        finally:
            fixture.close()


if __name__ == "__main__":
    unittest.main()
