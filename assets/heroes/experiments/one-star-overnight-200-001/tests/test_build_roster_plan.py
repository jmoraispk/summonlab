#!/usr/bin/env python3
"""Contract tests for the deterministic one-star roster materializer."""

from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from collections import Counter
from pathlib import Path
from unittest import mock


TEST_PATH = Path(__file__).resolve()
SCRIPT_PATH = TEST_PATH.parents[1] / "scripts" / "build_roster_plan.py"
sys.path.insert(0, str(SCRIPT_PATH.parent))
import contracts  # noqa: E402

SPEC = importlib.util.spec_from_file_location("build_roster_plan", SCRIPT_PATH)
assert SPEC and SPEC.loader
roster = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = roster
SPEC.loader.exec_module(roster)


class BuildRosterPlanTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.plan = roster.build_roster_plan()
        cls.active = cls.plan["active"]
        cls.reserves = cls.plan["reserves"]

    def test_fixed_seed_is_byte_deterministic(self) -> None:
        first = roster.canonical_json(self.plan)
        second = roster.canonical_json(roster.build_roster_plan())
        self.assertEqual(first, second)
        self.assertEqual(self.plan["planningSeed"], roster.PLANNING_SEED)
        self.assertEqual(
            self.plan["planContentSha256"],
            roster.canonical_sha256({key: value for key, value in self.plan.items() if key != "planContentSha256"}),
        )

    def test_cli_emits_plain_json(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            output = Path(temp_dir) / "roster.json"
            self.assertEqual(roster.main(["--output", str(output)]), 0)
            parsed = json.loads(output.read_text(encoding="utf-8"))
            with self.assertRaises(FileExistsError):
                roster.main(["--output", str(output)])
        self.assertEqual(parsed["schemaVersion"], roster.PLAN_SCHEMA_VERSION)
        self.assertEqual(len(parsed["active"]), 200)

    def test_counts_and_gender_specific_quotas_are_exact(self) -> None:
        self.assertEqual(len(self.active), 200)
        self.assertEqual(len(self.reserves), 20)
        self.assertEqual(Counter(item["quotaCoordinates"]["gender"] for item in self.active), {"man": 100, "woman": 100})
        for gender in ("man", "woman"):
            gender_items = [item for item in self.active if item["quotaCoordinates"]["gender"] == gender]
            self.assertEqual(Counter(item["quotaCoordinates"]["body"] for item in gender_items), roster.BODY_PER_GENDER)
            self.assertEqual(Counter(item["quotaCoordinates"]["height"] for item in gender_items), roster.HEIGHT_PER_GENDER)
            self.assertEqual(Counter(item["quotaCoordinates"]["ageBand"] for item in gender_items), roster.AGE_PER_GENDER)

    def test_every_global_active_quota_is_exact(self) -> None:
        for coordinate, expected in roster.ACTIVE_QUOTAS.items():
            actual = Counter(item["quotaCoordinates"][coordinate] for item in self.active)
            self.assertEqual(actual, expected, coordinate)
        self.assertEqual(
            sum(item["quotaCoordinates"]["hairAccent"] == "present" for item in self.active),
            120,
        )
        for item in self.active:
            if item["quotaCoordinates"]["detailDensity"] == "none":
                self.assertEqual(item["quotaCoordinates"]["tattoo"], "none")
                self.assertNotIn(
                    item["quotaCoordinates"]["coolnessAnchor"],
                    {"durable-body-marking", "jewelry-hardware"},
                )
            if item["quotaCoordinates"]["coolnessAnchor"] == "durable-body-marking":
                self.assertTrue(
                    item["quotaCoordinates"]["tattoo"] != "none"
                    or any(
                        token in anchor
                        for anchor in item["physicalManifest"]["personalDetails"]["visibleAnchors"]
                        for token in ("scar", "freckle", "birthmark")
                    )
                )
            if item["quotaCoordinates"]["coolnessAnchor"] == "jewelry-hardware":
                self.assertTrue(
                    any(
                        token in anchor
                        for anchor in item["physicalManifest"]["personalDetails"]["visibleAnchors"]
                        for token in ("earring", "buckle", "hair rings", "clasp")
                    )
                )

    def test_generated_identities_exclude_all_existing_experiment_identities(self) -> None:
        existing_ids, existing_names = roster.collect_existing_identity_keys()
        generated_ids = [item["heroId"] for item in self.active + self.reserves]
        generated_names = [roster.normalize_name(item["displayName"]) for item in self.active + self.reserves]
        self.assertEqual(len(generated_ids), len(set(generated_ids)))
        self.assertEqual(len(generated_names), len(set(generated_names)))
        self.assertFalse({value.casefold() for value in generated_ids} & existing_ids)
        self.assertFalse(set(generated_names) & existing_names)

    def test_kernels_are_strong_unique_and_pre_art(self) -> None:
        signatures = []
        for item in self.active + self.reserves:
            kernel = item["characterKernel"]
            self.assertTrue(kernel["dominantTrait"])
            self.assertTrue(kernel["counterTrait"])
            self.assertTrue(kernel["tension"])
            self.assertTrue(kernel["socialPresentation"])
            self.assertTrue(kernel["groomingMaintenance"])
            self.assertTrue(kernel["colorConfidence"])
            self.assertTrue(kernel["ornamentTolerance"])
            self.assertEqual(len(kernel["culturalFragments"]), 2)
            self.assertTrue(kernel["lifeEchoNoncanonical"])
            self.assertTrue(kernel["drawablePoseCue"])
            self.assertTrue(kernel["personalObject"])
            self.assertIn("Do not infer", kernel["mustNotInfer"])
            signatures.append(kernel["strengthSignature"])
        self.assertEqual(len(signatures), len(set(signatures)))

    def test_summon_targets_and_assignments_are_frozen_one_image_jobs(self) -> None:
        owned_paths: list[str] = []
        prompt_hashes: set[str] = set()
        for item in self.active + self.reserves:
            target = item["summonTarget"]
            assignment = item["summonAssignment"]
            self.assertEqual(target["imageKind"], "summon")
            self.assertEqual(target["starLevel"], 1)
            self.assertEqual(target["productionState"], "candidate-only")
            prompt = target["canonicalPrompt"]
            self.assertEqual(prompt["sha256"], roster.hashlib.sha256(prompt["text"].encode("utf-8")).hexdigest())
            self.assertEqual(assignment["targetId"], target["targetId"])
            self.assertEqual(assignment["targetSha256"], roster.canonical_sha256(target))
            self.assertEqual(assignment["permittedOutputs"], target["output"])
            self.assertTrue(assignment["completionContract"]["oneTargetOneImage"])
            self.assertEqual(
                contracts.validate_target(target, expected_path=item["summonTargetPath"]),
                target,
            )
            self.assertEqual(
                contracts.validate_assignment(
                    assignment,
                    target,
                    expected_path=item["summonAssignmentPath"],
                ),
                assignment,
            )
            self.assertEqual(item["futureChibi"]["state"], "not-materialized")
            self.assertNotIn("chibiTarget", item)
            self.assertNotIn("chibiAssignment", item)
            owned_paths.extend(item["pathPlan"].values())
            prompt_hashes.add(prompt["sha256"])
        self.assertEqual(len(owned_paths), len(set(owned_paths)))
        self.assertEqual(len(prompt_hashes), 220)

    def test_paths_are_relative_scoped_and_collision_safe(self) -> None:
        expected_prefix = f"assets/heroes/experiments/{roster.EXPERIMENT_ID}/waves/"
        for item in self.active + self.reserves:
            for path in item["pathPlan"].values():
                self.assertTrue(path.startswith(expected_prefix), path)
                self.assertNotIn("..", Path(path).parts)
                self.assertFalse(Path(path).is_absolute())
            self.assertEqual(len(item["summonAssignment"]["permittedOutputs"]), 2)

    def test_reference_hash_and_prompt_constraints_are_bound(self) -> None:
        expected_reference_hash = roster.file_sha256(roster.WORKSPACE_ROOT / roster.STYLE_REFERENCE)
        for item in self.active + self.reserves:
            target = item["summonTarget"]
            self.assertEqual(target["references"][0]["sha256"], expected_reference_hash)
            self.assertEqual(target["references"][0]["role"], "rendering-style")
            prompt = target["canonicalPrompt"]["text"].casefold()
            for required in ("exactly one", "weaponless", "painted drawing", "both hands", "both feet", "no weapon", "no affinity cue"):
                self.assertIn(required, prompt)
            for forbidden_copy in ("person", "braid", "clothes", "pose", "palette", "progression"):
                self.assertIn(forbidden_copy, prompt)

    def test_materialization_exclusive_creates_every_frozen_file(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            workspace = Path(temp_dir)
            summary = roster.materialize_roster_plan(self.plan, workspace)
            self.assertEqual(summary["createdFileCount"], 441)
            roster_path = workspace / summary["rosterPath"]
            self.assertEqual(json.loads(roster_path.read_text(encoding="utf-8")), self.plan)
            for item in self.active + self.reserves:
                target_path = workspace / item["summonTargetPath"]
                assignment_path = workspace / item["summonAssignmentPath"]
                self.assertEqual(json.loads(target_path.read_text(encoding="utf-8")), item["summonTarget"])
                self.assertEqual(
                    json.loads(assignment_path.read_text(encoding="utf-8")),
                    item["summonAssignment"],
                )
            with self.assertRaises(FileExistsError):
                roster.materialize_roster_plan(self.plan, workspace)

    def test_materialization_preflight_rejects_collision_without_writes(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            workspace = Path(temp_dir)
            collision = workspace / self.active[17]["summonAssignmentPath"]
            collision.parent.mkdir(parents=True)
            collision.write_text("owner data", encoding="utf-8")
            with self.assertRaises(FileExistsError):
                roster.materialize_roster_plan(self.plan, workspace)
            self.assertEqual(collision.read_text(encoding="utf-8"), "owner data")
            roster_path = workspace / f"assets/heroes/experiments/{roster.EXPERIMENT_ID}/roster-plan.json"
            self.assertFalse(roster_path.exists())
            self.assertFalse((workspace / self.active[0]["summonTargetPath"]).exists())

    def test_materialization_preflight_rejects_symlink_without_writes(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir, tempfile.TemporaryDirectory() as outside_dir:
            workspace = Path(temp_dir)
            experiment = workspace / f"assets/heroes/experiments/{roster.EXPERIMENT_ID}"
            experiment.mkdir(parents=True)
            (experiment / "waves").symlink_to(Path(outside_dir), target_is_directory=True)
            with self.assertRaises(FileExistsError):
                roster.materialize_roster_plan(self.plan, workspace)
            self.assertFalse((experiment / "roster-plan.json").exists())
            self.assertEqual(list(Path(outside_dir).iterdir()), [])

    def test_materialization_rolls_back_exact_created_inodes_on_failure(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            workspace = Path(temp_dir)
            original_write = roster._exclusive_write
            calls = 0

            def fail_fourth(root: Path, relative: str, payload: bytes) -> tuple[int, int]:
                nonlocal calls
                calls += 1
                if calls == 4:
                    raise OSError("injected materialization failure")
                return original_write(root, relative, payload)

            with mock.patch.object(roster, "_exclusive_write", side_effect=fail_fourth):
                with self.assertRaisesRegex(OSError, "injected materialization failure"):
                    roster.materialize_roster_plan(self.plan, workspace)
            self.assertFalse((workspace / self.active[0]["summonTargetPath"]).exists())
            self.assertFalse((workspace / self.active[0]["summonAssignmentPath"]).exists())
            roster_path = workspace / f"assets/heroes/experiments/{roster.EXPERIMENT_ID}/roster-plan.json"
            self.assertFalse(roster_path.exists())


if __name__ == "__main__":
    unittest.main()
