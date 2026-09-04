#!/usr/bin/env python3
"""Completion-gate tests for the five-head chibi regeneration experiment."""

from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from copy import deepcopy
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
WORKSPACE = ROOT.parents[3]
VALIDATE = ROOT / "scripts" / "validate_experiment.py"


class ValidateExperimentModuleExistsTests(unittest.TestCase):
    def test_validate_experiment_module_exists(self) -> None:
        self.assertTrue(VALIDATE.is_file(), "validate_experiment.py does not exist")


@unittest.skipUnless(VALIDATE.is_file(), "completion validator does not exist")
class ValidateExperimentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        sys.path.insert(0, str(VALIDATE.parent))
        spec = importlib.util.spec_from_file_location("five_head_validate_experiment", VALIDATE)
        assert spec and spec.loader
        cls.validator = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = cls.validator
        spec.loader.exec_module(cls.validator)
        cls.report = cls.validator.validate_experiment(root=ROOT)

    def test_completion_inventory_and_wave_sizes_are_exact(self) -> None:
        report = self.report
        self.assertEqual(report["status"], "complete")
        self.assertEqual(report["inventory"], {
            "sourceHeroes": 200, "targets": 200, "assignments": 200,
            "providerSources": 200, "candidates": 200, "results": 200, "waves": 13,
        })
        self.assertEqual([wave["planned"] for wave in report["waveValidation"]], [16] * 12 + [8])
        self.assertTrue(all(wave["complete"] for wave in report["waveValidation"]))

    def test_prompt_reference_and_output_contracts_are_exact(self) -> None:
        report = self.report
        self.assertEqual(report["prompt"], {
            "version": "five-head-v1",
            "templateSha256": "9b25033627bd99830e3dee3a2da7526852bd51e7a5d73b502c93ab43377c348c",
            "targetCount": 200,
            "soleSummonReferenceCount": 200,
        })
        self.assertEqual(report["outputs"], {
            "width": 1024, "height": 1536, "mimeType": "image/png",
            "readableProviderPngs": 200, "byteIdenticalCandidates": 200,
        })

    def test_source_call_and_candidate_lifecycle_evidence_is_frozen(self) -> None:
        report = self.report
        self.assertEqual(
            report["sourceEvidence"]["reviewManifestSha256"],
            "8ae3ee617fb200018c261cdee7b2e3fb5a2f1d807cea77df2fe75b78464c6fe5",
        )
        self.assertEqual(
            report["sourceEvidence"]["upstreamCompletionReportSha256"],
            "ce2534962da3c6e869cc3a18d26d6b88bd61ebfbef1a25915aabf0cdf4f370ef",
        )
        self.assertEqual(report["calls"], {
            "primary": 200, "retries": 1, "total": 201,
            "providerNoOutputPrimaries": 1, "successful": 200,
        })
        self.assertEqual(report["lifecycle"], "candidate")
        self.assertEqual(report["workflow"], {
            "approvals": 0, "runtimeBindings": 0, "review": False, "promotion": False,
            "committedFilesOutsideAuthorizedScope": 0,
        })

    def test_committed_scope_rejects_runtime_or_approved_catalog_changes(self) -> None:
        allowed = [
            "assets/heroes/experiments/five-head-chibi-regeneration-001/decision.json",
            "docs/wiki/art/hero-identity-and-evolution.md",
        ]
        self.validator.validate_committed_scope(allowed)
        for forbidden in (
            "assets/heroes/visuals/catalog.json",
            "assets/heroes/visuals/approved/new-hero.png",
            "packages/web/src/runtime-hero-catalog.ts",
        ):
            with self.subTest(forbidden=forbidden), self.assertRaises(self.validator.ContractError):
                self.validator.validate_committed_scope([*allowed, forbidden])

    def test_candidate_claim_scan_rejects_key_spelling_and_lifecycle_values(self) -> None:
        for document in (
            {"runtime_binding": "hero-a"},
            {"lifecycle": "approved"},
            {"status": "promoted"},
        ):
            with self.subTest(document=document), self.assertRaises(self.validator.ContractError):
                self.validator.reject_promotion_claim(document, "fixture")

    def test_summary_contract_rejects_every_completion_class_when_tampered(self) -> None:
        mutations = (
            ("source hash", lambda value: value["sourceEvidence"].__setitem__("reviewManifestSha256", "0" * 64)),
            ("inventory", lambda value: value["inventory"].__setitem__("results", 199)),
            ("wave size", lambda value: value["waveValidation"][0].__setitem__("planned", 15)),
            ("prompt", lambda value: value["prompt"].__setitem__("version", "other")),
            ("reference", lambda value: value["prompt"].__setitem__("soleSummonReferenceCount", 199)),
            ("PNG", lambda value: value["outputs"].__setitem__("readableProviderPngs", 199)),
            ("byte equality", lambda value: value["outputs"].__setitem__("byteIdenticalCandidates", 199)),
            ("primary calls", lambda value: value["calls"].__setitem__("primary", 199)),
            ("retry ceiling", lambda value: value["calls"].__setitem__("retries", 11)),
            ("lifecycle", lambda value: value.__setitem__("lifecycle", "approved")),
            ("approval", lambda value: value["workflow"].__setitem__("approvals", 1)),
            ("runtime binding", lambda value: value["workflow"].__setitem__("runtimeBindings", 1)),
        )
        for label, mutate in mutations:
            with self.subTest(label=label):
                changed = deepcopy(self.report)
                mutate(changed)
                with self.assertRaises(self.validator.ContractError):
                    self.validator.validate_completion_summary(changed)

    def test_completion_report_serialization_is_deterministic(self) -> None:
        first = self.validator.completion_report_bytes(self.report)
        second = self.validator.completion_report_bytes(self.validator.validate_experiment(root=ROOT))
        self.assertEqual(first, second)
        self.assertEqual(json.loads(first), self.report)


if __name__ == "__main__":
    unittest.main()
