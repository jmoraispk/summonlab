#!/usr/bin/env python3
"""Behavioral tests for the immutable five-head production queue."""

from __future__ import annotations

import copy
import importlib.util
import json
import multiprocessing
import queue
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


HERE = Path(__file__).resolve().parent
EXPERIMENT_ROOT = HERE.parent
SCRIPT_PATH = EXPERIMENT_ROOT / "scripts" / "materialize_plan.py"


def _load_materializer_in_process():
    sys.path.insert(0, str(SCRIPT_PATH.parent))
    spec = importlib.util.spec_from_file_location("five_head_materialize_plan_process", SCRIPT_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def _hold_writer_lock(root: str, ready, release) -> None:
    materializer = _load_materializer_in_process()
    with materializer._writer_lock(Path(root)):
        ready.set()
        release.wait(10)


def _materialize_in_process(root: str, roster: dict, targets: list, assignments: list, result) -> None:
    materializer = _load_materializer_in_process()
    try:
        result.put(("result", materializer.materialize(Path(root), roster, targets, assignments)))
    except Exception as error:  # pragma: no cover - asserted through the process queue
        result.put(("error", repr(error)))


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

    def test_rejects_a_syntactically_valid_but_hash_drifted_prompt_template(self) -> None:
        original_template_path = self.materializer.PROMPT_TEMPLATE_PATH
        with tempfile.TemporaryDirectory() as temporary:
            drifted_template = Path(temporary) / "prompt-template.txt"
            drifted_template.write_text(
                original_template_path.read_text(encoding="utf-8") + "\nStill valid prose.\n",
                encoding="utf-8",
            )
            self.materializer.PROMPT_TEMPLATE_PATH = drifted_template
            try:
                with self.assertRaisesRegex(self.materializer.ContractError, "prompt template hash"):
                    self.materializer.build_targets(self.roster)
            finally:
                self.materializer.PROMPT_TEMPLATE_PATH = original_template_path

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
            self.assertFalse((root / ".materialize-plan.transaction.json").exists())
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

    def test_write_rolls_back_published_paths_after_a_publication_failure(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "experiment"
            root.mkdir()
            calls = 0

            def fail_after_one_publish(*args, **kwargs):
                nonlocal calls
                calls += 1
                if calls == 2:
                    raise OSError("injected publication failure")
                return original_os_link(*args, **kwargs)

            import os
            original_os_link = os.link
            with patch("os.link", side_effect=fail_after_one_publish):
                with self.assertRaisesRegex(self.materializer.ContractError, "publish"):
                    self.materializer.materialize(root, self.roster, self.targets, self.assignments)
            self.assertFalse((root / "source-roster.json").exists())
            self.assertFalse((root / "production-plan.json").exists())
            self.assertFalse((root / ".materialize-plan.transaction.json").exists())
            with self.assertRaisesRegex(self.materializer.ContractError, "differs"):
                self.materializer.check(root, self.roster, self.targets, self.assignments)

    def test_check_rejects_an_interrupted_publication_marker(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "experiment"
            root.mkdir()
            self.materializer.materialize(root, self.roster, self.targets, self.assignments)
            (root / ".materialize-plan.transaction.json").write_text("{}", encoding="utf-8")
            with self.assertRaisesRegex(self.materializer.ContractError, "incomplete materialization"):
                self.materializer.check(root, self.roster, self.targets, self.assignments)

    def test_check_rejects_extra_target_assignment_or_wave_inventory(self) -> None:
        extras = (
            "waves/wave-01/targets/undeclared.json",
            "waves/wave-01/assignments/undeclared.json",
            "waves/wave-14/targets/undeclared.json",
        )
        for relative in extras:
            with self.subTest(relative=relative), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary) / "experiment"
                root.mkdir()
                self.materializer.materialize(root, self.roster, self.targets, self.assignments)
                extra = root / relative
                extra.parent.mkdir(parents=True, exist_ok=True)
                extra.write_text("{}\n", encoding="utf-8")
                with self.assertRaisesRegex(self.materializer.ContractError, "inventory"):
                    self.materializer.check(root, self.roster, self.targets, self.assignments)

    def test_only_the_exclusive_writer_can_publish_or_clear_its_transaction(self) -> None:
        context = multiprocessing.get_context("fork")
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "experiment"
            root.mkdir()
            ready, release, result = context.Event(), context.Event(), context.Queue()
            holder = context.Process(target=_hold_writer_lock, args=(str(root), ready, release))
            writer = context.Process(
                target=_materialize_in_process,
                args=(str(root), self.roster, self.targets, self.assignments, result),
            )
            holder.start()
            try:
                self.assertTrue(ready.wait(3), "the lock holder did not acquire exclusive ownership")
                writer.start()
                with self.assertRaises(queue.Empty):
                    result.get(timeout=1)
                release.set()
                writer.join(10)
                self.assertFalse(writer.is_alive(), "writer did not complete after lock release")
                kind, outcome = result.get(timeout=3)
                self.assertEqual(kind, "result", outcome)
                self.assertEqual(outcome["created"], 402)
                self.assertFalse((root / ".materialize-plan.transaction.json").exists())
                self.materializer.check(root, self.roster, self.targets, self.assignments)
            finally:
                release.set()
                for process in (holder, writer):
                    if process.pid is not None:
                        if process.is_alive():
                            process.terminate()
                        process.join(3)


if __name__ == "__main__":
    unittest.main()
