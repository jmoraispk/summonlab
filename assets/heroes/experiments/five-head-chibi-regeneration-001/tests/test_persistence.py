#!/usr/bin/env python3
"""Behavioral tests for immutable provider-output persistence."""

from __future__ import annotations

import hashlib
import importlib.util
import json
from io import BytesIO
import struct
import sys
import tempfile
import unittest
import zlib
from pathlib import Path

from PIL import Image


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
PERSIST = ROOT / "scripts" / "persist_candidate.py"
WRITE_RESULT = ROOT / "scripts" / "write_result.py"


def png(width: int = 1024, height: int = 1536, payload: bytes = b"\x00") -> bytes:
    """Create a fully decodable RGB PNG, not merely a valid chunk envelope."""
    image = Image.new("RGB", (width, height), color=(payload[0] if payload else 0, 20, 40))
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def truncated_raster_png(width: int = 1024, height: int = 1536) -> bytes:
    """Make an envelope-valid PNG whose decompressed raster has only one scanline byte."""
    signature = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    def chunk(kind: bytes, value: bytes) -> bytes:
        return struct.pack(">I", len(value)) + kind + value + struct.pack(">I", zlib.crc32(kind + value) & 0xffffffff)
    return signature + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(b"\x00")) + chunk(b"IEND", b"")


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def canonical(value: object) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode()


class PersistenceModuleExistsTests(unittest.TestCase):
    def test_persistence_modules_exist(self) -> None:
        self.assertTrue(PERSIST.is_file(), "persist_candidate.py does not exist")
        self.assertTrue(WRITE_RESULT.is_file(), "write_result.py does not exist")


@unittest.skipUnless(PERSIST.is_file() and WRITE_RESULT.is_file(), "persistence scripts do not exist")
class PersistenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        sys.path.insert(0, str(PERSIST.parent))
        spec = importlib.util.spec_from_file_location("five_head_persist", PERSIST)
        assert spec and spec.loader
        cls.persist = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = cls.persist
        spec.loader.exec_module(cls.persist)
        spec = importlib.util.spec_from_file_location("five_head_write_result", WRITE_RESULT)
        assert spec and spec.loader
        cls.results = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = cls.results
        spec.loader.exec_module(cls.results)

    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.workspace = Path(self.temporary.name) / "workspace"
        self.experiment = self.workspace / "assets/heroes/experiments/five-head-chibi-regeneration-001"
        self.assignment_path = self.experiment / "waves/wave-01/assignments/hero-a.json"
        self.target_path = self.experiment / "waves/wave-01/targets/hero-a.json"
        self.source_path = self.workspace / "provider-return.png"
        self.image = png()
        self.source_path.parent.mkdir(parents=True)
        self.source_path.write_bytes(self.image)
        self.target = {
            "schemaVersion": "five-head-chibi-target-v1", "experimentId": "five-head-chibi-regeneration-001",
            "targetId": "hero-a-five-head-combat-chibi-v1", "heroId": "hero-a", "waveId": "wave-01",
            "renderedPrompt": "exact rendered prompt", "renderedPromptSha256": digest(b"exact rendered prompt"),
            "generationReferences": [{"path": "assets/upstream/summon.png", "sha256": "a" * 64, "role": "sole-summon-authority"}],
            "output": {"width": 1024, "height": 1536, "mimeType": "image/png"}, "lifecycle": "candidate",
        }
        self.assignment = {
            "schemaVersion": "five-head-chibi-assignment-v1", "experimentId": "five-head-chibi-regeneration-001",
            "assignmentId": "assignment-hero-a-five-head-combat-chibi-v1", "targetId": self.target["targetId"],
            "heroId": "hero-a", "waveId": "wave-01", "exclusiveOwner": "assignment-hero-a-five-head-combat-chibi-v1",
            "status": "planned",
            "providerSourcePath": "assets/heroes/experiments/five-head-chibi-regeneration-001/waves/wave-01/provider-sources/hero-a.png",
            "candidatePath": "assets/heroes/experiments/five-head-chibi-regeneration-001/waves/wave-01/candidates/hero-a.png",
            "resultPath": "assets/heroes/experiments/five-head-chibi-regeneration-001/waves/wave-01/results/hero-a.json",
        }
        self.target_path.parent.mkdir(parents=True)
        self.target_path.write_bytes(canonical(self.target))
        self.assignment_path.parent.mkdir(parents=True)
        self.assignment_path.write_bytes(canonical(self.assignment))

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def call(self):
        return self.persist.persist_candidate(self.assignment_path, self.source_path)

    def test_persists_byte_identical_provider_source_and_candidate(self) -> None:
        persisted = self.call()
        self.assertEqual(persisted.width, 1024)
        self.assertEqual(persisted.height, 1536)
        self.assertEqual(persisted.mime_type, "image/png")
        self.assertEqual(persisted.sha256, digest(self.image))
        self.assertEqual(persisted.provider_source_path.read_bytes(), self.image)
        self.assertEqual(persisted.candidate_path.read_bytes(), self.image)

    def test_rejects_unreadable_or_wrong_sized_provider_png(self) -> None:
        self.source_path.write_bytes(b"not a png")
        with self.assertRaisesRegex(self.persist.ContractError, "readable PNG"):
            self.call()
        self.source_path.write_bytes(png(1023, 1536))
        with self.assertRaisesRegex(self.persist.ContractError, "1024x1536"):
            self.call()
        self.source_path.write_bytes(truncated_raster_png())
        with self.assertRaisesRegex(self.persist.ContractError, "readable PNG"):
            self.call()

    def test_resumes_only_when_existing_bytes_are_identical(self) -> None:
        first = self.call()
        second = self.call()
        self.assertEqual(first.provider_source_status, "created")
        self.assertEqual(second.provider_source_status, "already-identical")
        self.source_path.write_bytes(png(payload=b"different"))
        with self.assertRaisesRegex(self.persist.ContractError, "different bytes"):
            self.call()

    def test_refuses_a_conflicting_occupied_candidate_without_overwrite(self) -> None:
        candidate = self.workspace / self.assignment["candidatePath"]
        candidate.parent.mkdir(parents=True)
        candidate.write_bytes(b"conflicting bytes")
        with self.assertRaisesRegex(self.persist.ContractError, "different bytes"):
            self.call()
        self.assertEqual(candidate.read_bytes(), b"conflicting bytes")

    def test_writes_complete_receipt_bound_to_target_assignment_and_call(self) -> None:
        persisted = self.call()
        call_path = self.workspace / "call.json"
        call = {
            "schemaVersion": "five-head-chibi-provider-call-v1", "experimentId": self.assignment["experimentId"],
            "assignmentId": self.assignment["assignmentId"], "targetId": self.target["targetId"], "waveId": "wave-01",
            "callOrdinal": 1, "callKind": "primary", "startedAt": "2026-09-04T00:00:00Z",
            "completedAt": "2026-09-04T00:01:00Z", "outcome": "succeeded",
            "providerMetadata": {"provider": "imagegen", "requestId": "request-1"},
        }
        call_path.write_bytes(canonical(call))
        result_path = self.results.write_result(self.assignment_path, call_path)
        result = json.loads(result_path.read_text())
        self.assertEqual(result["schemaVersion"], "five-head-chibi-result-v1")
        self.assertEqual(result["targetSha256"], digest(canonical(self.target)))
        self.assertEqual(result["assignmentSha256"], digest(canonical(self.assignment)))
        self.assertEqual(result["renderedPrompt"], self.target["renderedPrompt"])
        self.assertEqual(result["renderedPromptSha256"], self.target["renderedPromptSha256"])
        self.assertEqual(result["reference"], self.target["generationReferences"][0])
        self.assertEqual(result["providerSourceSha256"], persisted.sha256)
        self.assertEqual(result["candidateSha256"], persisted.sha256)
        self.assertEqual(result["dimensions"], {"width": 1024, "height": 1536})
        self.assertEqual(result["mimeType"], "image/png")
        self.assertEqual(result["callKind"], "primary")

    def test_rejects_call_records_not_bound_to_assignment_or_call_kind_enum(self) -> None:
        self.call()
        call_path = self.workspace / "call.json"
        call = {"schemaVersion": "five-head-chibi-provider-call-v1", "experimentId": self.assignment["experimentId"],
                "assignmentId": "other", "targetId": self.target["targetId"], "waveId": "wave-01", "callOrdinal": 1,
                "callKind": "unsupported", "startedAt": "2026-09-04T00:00:00Z", "completedAt": "2026-09-04T00:01:00Z",
                "outcome": "succeeded", "providerMetadata": {"provider": "imagegen"}}
        call_path.write_bytes(canonical(call))
        with self.assertRaisesRegex(self.results.ContractError, "assignmentId"):
            self.results.write_result(self.assignment_path, call_path)
        call["assignmentId"] = self.assignment["assignmentId"]
        call_path.write_bytes(canonical(call))
        with self.assertRaisesRegex(self.results.ContractError, "callKind"):
            self.results.write_result(self.assignment_path, call_path)
