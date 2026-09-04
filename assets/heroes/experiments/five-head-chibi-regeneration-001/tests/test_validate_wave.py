#!/usr/bin/env python3
"""Behavioral tests for strict five-head wave validation."""

from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
VALIDATE = ROOT / "scripts" / "validate_wave.py"
PERSIST_TESTS = HERE / "test_persistence.py"


class ValidateWaveModuleExistsTests(unittest.TestCase):
    def test_validate_wave_module_exists(self) -> None:
        self.assertTrue(VALIDATE.is_file(), "validate_wave.py does not exist")


@unittest.skipUnless(VALIDATE.is_file() and PERSIST_TESTS.is_file(), "validation scripts do not exist")
class ValidateWaveTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        sys.path.insert(0, str(VALIDATE.parent))
        spec = importlib.util.spec_from_file_location("five_head_validate", VALIDATE)
        assert spec and spec.loader
        cls.validator = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = cls.validator
        spec.loader.exec_module(cls.validator)
        spec = importlib.util.spec_from_file_location("five_head_persistence_tests", PERSIST_TESTS)
        assert spec and spec.loader
        cls.fixtures = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = cls.fixtures
        spec.loader.exec_module(cls.fixtures)

    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.workspace = Path(self.temporary.name) / "workspace"
        self.root = self.workspace / "assets/heroes/experiments/five-head-chibi-regeneration-001"
        self.assignment = {
            "schemaVersion": "five-head-chibi-assignment-v1", "experimentId": "five-head-chibi-regeneration-001",
            "assignmentId": "assignment-hero-a-five-head-combat-chibi-v1", "targetId": "hero-a-five-head-combat-chibi-v1",
            "heroId": "hero-a", "waveId": "wave-01", "exclusiveOwner": "assignment-hero-a-five-head-combat-chibi-v1", "status": "planned",
            "providerSourcePath": "assets/heroes/experiments/five-head-chibi-regeneration-001/waves/wave-01/provider-sources/hero-a.png",
            "candidatePath": "assets/heroes/experiments/five-head-chibi-regeneration-001/waves/wave-01/candidates/hero-a.png",
            "resultPath": "assets/heroes/experiments/five-head-chibi-regeneration-001/waves/wave-01/results/hero-a.json",
        }
        self.target = {
            "schemaVersion": "five-head-chibi-target-v1", "experimentId": self.assignment["experimentId"],
            "targetId": self.assignment["targetId"], "heroId": "hero-a", "waveId": "wave-01", "renderedPrompt": "prompt",
            "renderedPromptSha256": self.fixtures.digest(b"prompt"),
            "generationReferences": [{"path": "assets/source.png", "sha256": "a" * 64, "role": "sole-summon-authority"}],
            "output": {"width": 1024, "height": 1536, "mimeType": "image/png"}, "lifecycle": "candidate",
        }
        plan = {"schemaVersion": "five-head-chibi-production-plan-v1", "experimentId": self.assignment["experimentId"],
                "targets": [self.target], "assignments": [self.assignment], "waveSizes": [1]}
        self._write(self.root / "production-plan.json", plan)
        self._write(self.root / "waves/wave-01/targets/hero-a.json", self.target)
        self._write(self.root / "waves/wave-01/assignments/hero-a.json", self.assignment)
        (self.root / "provenance").mkdir(parents=True, exist_ok=True)

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def _write(self, path: Path, value: object) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n")

    def test_ungenerated_wave_reports_planned_work_without_completion(self) -> None:
        result = self.validator.validate_wave("wave-01", root=self.root)
        self.assertEqual(result.status, "planned")
        self.assertEqual(result.planned, 1)
        self.assertEqual(result.completed, 0)
        self.assertFalse(result.complete)

    def test_accepts_one_journal_bound_primary_result(self) -> None:
        image = self.fixtures.png()
        source = self.workspace / self.assignment["providerSourcePath"]
        candidate = self.workspace / self.assignment["candidatePath"]
        source.parent.mkdir(parents=True); candidate.parent.mkdir(parents=True)
        source.write_bytes(image); candidate.write_bytes(image)
        target_sha, assignment_sha, image_sha = self.fixtures.digest((self.root / "waves/wave-01/targets/hero-a.json").read_bytes()), self.fixtures.digest((self.root / "waves/wave-01/assignments/hero-a.json").read_bytes()), self.fixtures.digest(image)
        call = {"schemaVersion": "five-head-chibi-provider-call-v1", "experimentId": self.assignment["experimentId"], "assignmentId": self.assignment["assignmentId"], "targetId": self.target["targetId"], "waveId": "wave-01", "callOrdinal": 1, "callKind": "primary", "startedAt": "2026-09-04T00:00:00Z", "completedAt": "2026-09-04T00:01:00Z", "outcome": "succeeded", "providerMetadata": {"provider": "imagegen"}}
        result = {"schemaVersion": "five-head-chibi-result-v1", "experimentId": self.assignment["experimentId"], "assignmentId": self.assignment["assignmentId"], "targetId": self.target["targetId"], "waveId": "wave-01", "targetSha256": target_sha, "assignmentSha256": assignment_sha, "renderedPrompt": "prompt", "renderedPromptSha256": self.target["renderedPromptSha256"], "reference": self.target["generationReferences"][0], "providerSourcePath": self.assignment["providerSourcePath"], "providerSourceSha256": image_sha, "candidatePath": self.assignment["candidatePath"], "candidateSha256": image_sha, "dimensions": {"width": 1024, "height": 1536}, "mimeType": "image/png", "providerMetadata": call["providerMetadata"], "callOrdinal": 1, "callKind": "primary", "startedAt": call["startedAt"], "completedAt": call["completedAt"], "resultWrittenAt": "2026-09-04T00:01:01Z"}
        self._write(self.workspace / self.assignment["resultPath"], result)
        journal = self.root / "provenance/production-journal.jsonl"
        journal.write_text(json.dumps(call, sort_keys=True) + "\n")
        validated = self.validator.validate_wave("wave-01", root=self.root)
        self.assertTrue(validated.complete)
        self.assertEqual(validated.status, "complete")
        self.assertEqual(validated.completed, 1)

    def test_rejects_missing_journal_duplicate_primary_retry_misuse_and_global_retry_excess(self) -> None:
        journal = self.root / "provenance/production-journal.jsonl"
        journal.write_text("\n")
        with self.assertRaisesRegex(self.validator.ContractError, "journal"):
            self.validator.validate_wave("wave-01", root=self.root)
        base = {"schemaVersion": "five-head-chibi-provider-call-v1", "experimentId": self.assignment["experimentId"], "assignmentId": self.assignment["assignmentId"], "targetId": self.target["targetId"], "waveId": "wave-01", "callOrdinal": 1, "callKind": "primary", "startedAt": "2026-09-04T00:00:00Z", "completedAt": "2026-09-04T00:01:00Z", "outcome": "succeeded", "providerMetadata": {"provider": "imagegen"}}
        duplicate = dict(base); duplicate["callOrdinal"] = 2
        journal.write_text("\n".join(json.dumps(item) for item in (base, duplicate)) + "\n")
        with self.assertRaisesRegex(self.validator.ContractError, "primary"):
            self.validator.validate_wave("wave-01", root=self.root)
        retry = dict(base); retry.update({"callOrdinal": 2, "callKind": "provider-no-output-retry"})
        journal.write_text("\n".join(json.dumps(item) for item in (base, retry)) + "\n")
        with self.assertRaisesRegex(self.validator.ContractError, "no-output"):
            self.validator.validate_wave("wave-01", root=self.root)
        records = []
        for number in range(11):
            record = dict(retry); record.update({"assignmentId": f"a-{number}", "targetId": f"t-{number}", "heroId": f"h-{number}"})
            records.append(record)
        journal.write_text("\n".join(json.dumps(item) for item in records) + "\n")
        with self.assertRaisesRegex(self.validator.ContractError, "retry ceiling"):
            self.validator.validate_wave("wave-01", root=self.root)

    def test_rejects_undeclared_duplicate_and_cross_wave_output_paths(self) -> None:
        malformed = dict(self.assignment)
        malformed["candidatePath"] = malformed["providerSourcePath"]
        self._write(self.root / "waves/wave-01/assignments/hero-a.json", malformed)
        with self.assertRaisesRegex(self.validator.ContractError, "exclusive"):
            self.validator.validate_wave("wave-01", root=self.root)
        malformed = dict(self.assignment)
        malformed["candidatePath"] = malformed["candidatePath"].replace("wave-01", "wave-02")
        self._write(self.root / "waves/wave-01/assignments/hero-a.json", malformed)
        with self.assertRaisesRegex(self.validator.ContractError, "cross-wave"):
            self.validator.validate_wave("wave-01", root=self.root)
