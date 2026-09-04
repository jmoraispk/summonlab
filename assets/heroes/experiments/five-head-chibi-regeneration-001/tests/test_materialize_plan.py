#!/usr/bin/env python3
"""Behavioral tests for the immutable five-head production queue."""

from __future__ import annotations

import copy
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


HERE = Path(__file__).resolve().parent
EXPERIMENT_ROOT = HERE.parent
SCRIPT_PATH = EXPERIMENT_ROOT / "scripts" / "materialize_plan.py"


class MaterializerModuleExistsTests(unittest.TestCase):
    def test_materializer_module_exists(self) -> None:
        self.assertTrue(SCRIPT_PATH.is_file(), "the production-plan materializer does not exist")


@unittest.skipUnless(SCRIPT_PATH.is_file(), "the production-plan materializer does not exist")
class MaterializerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        sys.path.insert(0, str(SCRIPT_PATH.parent))
        spec = importlib.util.spec_from_file_location("five_head_materialize_plan", SCRIPT_PATH)
        assert spec and spec.loader
        cls.materializer = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = cls.materializer
        spec.loader.exec_module(cls.materializer)

        cls.frozen_pairs = cls.materializer.load_selected_pairs()
        cls.frozen_roster = cls.materializer.build_source_roster(cls.frozen_pairs)
        cls.frozen_targets = cls.materializer.build_targets(cls.frozen_roster)
        cls.frozen_assignments = cls.materializer.build_assignments(cls.frozen_targets)

    def setUp(self) -> None:
        self.pairs = copy.deepcopy(self.frozen_pairs)
        self.roster = copy.deepcopy(self.frozen_roster)
        self.targets = copy.deepcopy(self.frozen_targets)
        self.assignments = copy.deepcopy(self.frozen_assignments)

    def test_load_selected_pairs_freezes_exactly_200_verified_sources(self) -> None:
        self.assertEqual(len(self.pairs), 200)
        self.assertEqual(len({pair.hero_id for pair in self.pairs}), 200)
        self.assertEqual(
            [(pair.design_ordinal, pair.hero_id) for pair in self.pairs],
            sorted((pair.design_ordinal, pair.hero_id) for pair in self.pairs),
        )
        self.assertEqual(self.roster["upstreamManifestSha256"], self.materializer.SOURCE_ROSTER_SHA256)
        self.assertEqual(len(self.roster["records"]), 200)

    def test_rejects_upstream_manifest_hash_drift(self) -> None:
        manifest = self.materializer._load_upstream_manifest()
        manifest["selectedPairs"][0]["displayName"] = "Drifted Name"
        with self.assertRaisesRegex(self.materializer.ContractError, "upstream manifest hash"):
            self.materializer.load_selected_pairs(manifest=manifest)

    def test_rejects_count_and_duplicate_hero_or_target_ids(self) -> None:
        with self.assertRaisesRegex(self.materializer.ContractError, "exactly 200"):
            self.materializer.build_source_roster(self.pairs[:-1])

        duplicate_pair = copy.copy(self.pairs[0])
        with self.assertRaisesRegex(self.materializer.ContractError, "duplicate heroId"):
            self.materializer.build_source_roster([*self.pairs[:-1], duplicate_pair])

        duplicated_target = copy.deepcopy(self.targets)
        duplicated_target[1]["targetId"] = duplicated_target[0]["targetId"]
        with self.assertRaisesRegex(self.materializer.ContractError, "duplicate targetId"):
            self.materializer.build_assignments(duplicated_target)

    def test_rejects_missing_or_mismatched_summon_source_hash(self) -> None:
        pair = self.pairs[0]
        bad_pair = copy.copy(pair)
        bad_pair.summon_sha256 = "0" * 64
        with self.assertRaisesRegex(self.materializer.ContractError, "summon PNG hash"):
            self.materializer.build_source_roster([bad_pair, *self.pairs[1:]])

        missing_pair = copy.copy(pair)
        missing_pair.summon_path = "assets/heroes/not-a-summon.png"
        with self.assertRaisesRegex(self.materializer.ContractError, "summon PNG"):
            self.materializer.build_source_roster([missing_pair, *self.pairs[1:]])

    def test_targets_bind_only_summons_and_render_complete_prompts(self) -> None:
        self.assertEqual(len(self.targets), 200)
        for target in self.targets:
            with self.subTest(target=target["targetId"]):
                self.assertEqual(len(target["generationReferences"]), 1)
                self.assertEqual(target["generationReferences"][0]["role"], "sole-summon-authority")
                self.assertNotIn("combat-chibi", target["generationReferences"][0]["path"])
                self.assertIn("historicalChibi", target)
                self.assertNotIn("[", target["renderedPrompt"])
                self.assertNotIn("]", target["renderedPrompt"])
                self.assertEqual(target["renderedPromptSha256"], self.materializer.sha256_text(target["renderedPrompt"]))

    def test_assignments_are_exclusive_and_chunked_in_dispatch_order(self) -> None:
        self.assertEqual(len(self.assignments), 200)
        target_ids = [target["targetId"] for target in self.targets]
        self.assertEqual([assignment["targetId"] for assignment in self.assignments], target_ids)
        all_paths = [
            path
            for assignment in self.assignments
            for path in (assignment["providerSourcePath"], assignment["candidatePath"], assignment["resultPath"])
        ]
        self.assertEqual(len(all_paths), len(set(all_paths)))
        self.assertTrue(all(assignment["exclusiveOwner"] == assignment["assignmentId"] for assignment in self.assignments))
        self.assertEqual(
            [sum(assignment["waveId"] == f"wave-{wave:02d}" for assignment in self.assignments) for wave in range(1, 14)],
            [16] * 12 + [8],
        )

    def test_check_rejects_nonexclusive_paths_and_wrong_wave_size(self) -> None:
        plan = self.materializer.build_production_plan(self.roster, self.targets, self.assignments)
        duplicate_paths = copy.deepcopy(plan)
        duplicate_paths["assignments"][1]["candidatePath"] = duplicate_paths["assignments"][0]["candidatePath"]
        with self.assertRaisesRegex(self.materializer.ContractError, "exclusive"):
            self.materializer.validate_plan(duplicate_paths)

        wrong_waves = copy.deepcopy(plan)
        wrong_waves["assignments"][16]["waveId"] = "wave-01"
        with self.assertRaisesRegex(self.materializer.ContractError, "wave sizes"):
            self.materializer.validate_plan(wrong_waves)

    def test_write_is_idempotent_and_conflicts_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "experiment"
            root.mkdir()
            generated = self.materializer.materialize(root, self.roster, self.targets, self.assignments)
            self.assertEqual(generated["created"], 402)
            repeated = self.materializer.materialize(root, self.roster, self.targets, self.assignments)
            self.assertEqual(repeated["alreadyIdentical"], 402)
            target_path = root / "waves" / "wave-01" / "targets" / f"{self.targets[0]['heroId']}.json"
            target_path.write_text("{}", encoding="utf-8")
            with self.assertRaisesRegex(self.materializer.ContractError, "different bytes"):
                self.materializer.materialize(root, self.roster, self.targets, self.assignments)

    def test_write_preflights_a_broken_symlink_before_creating_any_files(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "experiment"
            target_path = root / "waves" / "wave-01" / "targets" / f"{self.targets[0]['heroId']}.json"
            target_path.parent.mkdir(parents=True)
            target_path.symlink_to(root / "missing-target.json")
            with self.assertRaisesRegex(self.materializer.ContractError, "occupied path"):
                self.materializer.materialize(root, self.roster, self.targets, self.assignments)
            self.assertFalse((root / "source-roster.json").exists())


if __name__ == "__main__":
    unittest.main()
