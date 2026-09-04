#!/usr/bin/env python3
"""Contract tests for the five-head combat-chibi regeneration experiment."""

from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


HERE = Path(__file__).resolve().parent
EXPERIMENT_ROOT = HERE.parent
CONTRACTS_PATH = EXPERIMENT_ROOT / "scripts" / "contracts.py"
DECISION_PATH = EXPERIMENT_ROOT / "decision.json"
PROMPT_PATH = EXPERIMENT_ROOT / "prompt-template.txt"


class ContractModuleExistsTests(unittest.TestCase):
    def test_contract_module_exists(self) -> None:
        self.assertTrue(CONTRACTS_PATH.is_file(), "the frozen contract module does not exist")


@unittest.skipUnless(CONTRACTS_PATH.is_file(), "the frozen contract module does not exist")
class FrozenExperimentContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        spec = importlib.util.spec_from_file_location("five_head_contracts", CONTRACTS_PATH)
        assert spec and spec.loader
        cls.contracts = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = cls.contracts
        spec.loader.exec_module(cls.contracts)

    def test_frozen_values_define_the_production_envelope(self) -> None:
        contract = self.contracts

        self.assertEqual(contract.EXPERIMENT_ID, "five-head-chibi-regeneration-001")
        self.assertEqual((contract.CANVAS_WIDTH, contract.CANVAS_HEIGHT), (1024, 1536))
        self.assertEqual(contract.RATIO_TARGET, 5.0)
        self.assertEqual(contract.PROMPT_VERSION, "five-head-v1")
        self.assertEqual(
            contract.SOURCE_ROSTER_SHA256,
            "8ae3ee617fb200018c261cdee7b2e3fb5a2f1d807cea77df2fe75b78464c6fe5",
        )
        self.assertEqual(contract.WAVE_SIZES, (16,) * 12 + (8,))
        self.assertEqual(contract.PRIMARY_CALL_LIMIT, 200)
        self.assertEqual(contract.RETRY_CALL_LIMIT, 10)
        self.assertEqual(contract.LIFECYCLE, "candidate")

    def test_decision_binds_the_exact_template_and_candidate_only_workflow(self) -> None:
        contract = self.contracts
        decision = contract.load_json(DECISION_PATH)

        self.assertEqual(decision["experimentId"], contract.EXPERIMENT_ID)
        self.assertEqual(decision["promptVersion"], "five-head-v1")
        self.assertEqual(decision["canvas"], {"width": 1024, "height": 1536, "mimeType": "image/png"})
        self.assertEqual(decision["ratioTarget"], 5.0)
        self.assertEqual(decision["sourceRosterSha256"], contract.SOURCE_ROSTER_SHA256)
        self.assertEqual(decision["waveSizes"], [16] * 12 + [8])
        self.assertEqual(decision["primaryCallLimit"], 200)
        self.assertEqual(decision["retryCallLimit"], 10)
        self.assertEqual(decision["lifecycle"], "candidate")
        self.assertFalse(decision["workflow"]["pilot"])
        self.assertFalse(decision["workflow"]["review"])
        self.assertFalse(decision["workflow"]["promotion"])
        self.assertEqual(decision["promptTemplateSha256"], contract.sha256_file(PROMPT_PATH))
        self.assertEqual(
            contract.sha256_file(PROMPT_PATH),
            "9b25033627bd99830e3dee3a2da7526852bd51e7a5d73b502c93ab43377c348c",
        )

    def test_load_json_rejects_non_contract_shapes(self) -> None:
        contract = self.contracts
        decision = json.loads(DECISION_PATH.read_text(encoding="utf-8"))
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "decision.json"
            decision["schemaVersion"] = "unsupported-v1"
            path.write_text(json.dumps(decision), encoding="utf-8")
            with self.assertRaises(contract.ContractError):
                contract.load_json(path)

            decision["schemaVersion"] = contract.SCHEMA_DECISION
            decision["sourceRosterSha256"] = "not-a-sha256"
            path.write_text(json.dumps(decision), encoding="utf-8")
            with self.assertRaises(contract.ContractError):
                contract.load_json(path)

    def test_confine_relative_rejects_escapes(self) -> None:
        contract = self.contracts
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "root"
            root.mkdir()
            self.assertEqual(contract.confine_relative(root, "wave-01/target.json"), root / "wave-01/target.json")
            for value in ("/tmp/escape", "../escape", "wave-01/../../escape"):
                with self.subTest(value=value):
                    with self.assertRaises(contract.ContractError):
                        contract.confine_relative(root, value)

            outside = Path(temporary) / "outside"
            outside.mkdir()
            (root / "linked").symlink_to(outside, target_is_directory=True)
            with self.assertRaises(contract.ContractError):
                contract.confine_relative(root, "linked/escape.json")

    def test_exclusive_write_is_collision_safe(self) -> None:
        contract = self.contracts
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "candidate.png"
            self.assertEqual(contract.exclusive_write(path, b"candidate-bytes"), "created")
            self.assertEqual(contract.exclusive_write(path, b"candidate-bytes"), "already-identical")
            with self.assertRaises(contract.ContractError):
                contract.exclusive_write(path, b"different-bytes")

    def test_render_prompt_allows_only_the_six_canonical_substitutions(self) -> None:
        contract = self.contracts
        template = PROMPT_PATH.read_text(encoding="utf-8")
        substitutions = {
            "identity\nfacts": "face and apparent age",
            "body construction": "lean adult build",
            "hair silhouette": "short copper crop",
            "wardrobe construction and palette": "ochre layered wraps",
            "footwear": "dark ankle boots",
            "durable accessories, tattoos, and markings": "a copper ear cuff",
        }

        rendered = contract.render_prompt(template, substitutions)
        self.assertNotIn("[", rendered)
        self.assertNotIn("]", rendered)
        with self.assertRaises(contract.ContractError):
            contract.render_prompt(template, {**substitutions, "unexpected": "value"})
        with self.assertRaises(contract.ContractError):
            contract.render_prompt(template, {key: value for key, value in substitutions.items() if key != "footwear"})
        with self.assertRaises(contract.ContractError):
            contract.render_prompt(template, {**substitutions, "footwear": "[unresolved]"})


if __name__ == "__main__":
    unittest.main()
