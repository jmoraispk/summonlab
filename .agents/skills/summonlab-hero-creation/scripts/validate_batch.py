#!/usr/bin/env python3
"""Validate one candidate-only Summonlab hero-pair creation batch."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import struct
from pathlib import Path, PurePosixPath
from typing import Any


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
SHA256 = re.compile(r"^[a-f0-9]{64}$")
HERO_ID = re.compile(r"^[a-z][a-z0-9-]{1,79}$")
BATCH_ID = re.compile(r"^hero-creation-[0-9]{8}-[a-z0-9]+(?:-[a-z0-9]+)*-[0-9]{3}$")


class ValidationError(ValueError):
    """Raised when a batch violates the artifact contract."""


def read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValidationError(f"expected JSON object: {path}")
    return value


def hash_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def png_dimensions(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if len(data) < 24 or data[:8] != PNG_SIGNATURE or data[12:16] != b"IHDR":
        raise ValidationError(f"not a readable PNG: {path}")
    return struct.unpack(">II", data[16:24])


def resolve_repo_path(workspace: Path, value: Any, batch_prefix: str) -> Path:
    if not isinstance(value, str):
        raise ValidationError("artifact path must be text")
    pure = PurePosixPath(value)
    if pure.is_absolute() or ".." in pure.parts or not value.startswith(f"{batch_prefix}/"):
        raise ValidationError(f"artifact path escapes batch: {value}")
    path = workspace.joinpath(*pure.parts)
    if path.is_symlink():
        raise ValidationError(f"artifact must not be a symlink: {value}")
    return path


def validate_result(
    workspace: Path,
    batch_prefix: str,
    batch_id: str,
    hero_id: str,
    result_path: str,
    expected_kind: str,
    summon_source: tuple[str, str] | None,
    expected_prompt: str | None = None,
) -> tuple[str, str]:
    path = resolve_repo_path(workspace, result_path, batch_prefix)
    result = read_json(path)
    required = {
        "schemaVersion",
        "batchId",
        "heroId",
        "imageKind",
        "version",
        "status",
        "width",
        "height",
        "prompt",
        "promptSha256",
        "references",
        "providerSourcePath",
        "providerSourceSha256",
        "candidatePath",
        "candidateSha256",
    }
    if set(result) != required:
        raise ValidationError(f"result fields differ from contract: {result_path}")
    if (
        result["schemaVersion"] != "summonlab-hero-image-result-v1"
        or result["batchId"] != batch_id
        or result["heroId"] != hero_id
        or result["imageKind"] != expected_kind
        or result["version"] != 1
        or result["status"] != "candidate"
        or (result["width"], result["height"]) != (1024, 1536)
    ):
        raise ValidationError(f"result identity or image contract failed: {result_path}")
    prompt = result["prompt"]
    if not isinstance(prompt, str) or not prompt.strip():
        raise ValidationError(f"result prompt is empty: {result_path}")
    if result["promptSha256"] != hashlib.sha256(prompt.encode("utf-8")).hexdigest():
        raise ValidationError(f"prompt hash mismatch: {result_path}")
    if expected_prompt is not None and prompt != expected_prompt:
        raise ValidationError(f"summon result prompt differs from the authored brief: {result_path}")

    provider_path = resolve_repo_path(workspace, result["providerSourcePath"], batch_prefix)
    candidate_path = resolve_repo_path(workspace, result["candidatePath"], batch_prefix)
    provider_hash = hash_file(provider_path)
    candidate_hash = hash_file(candidate_path)
    for digest in (result["providerSourceSha256"], result["candidateSha256"]):
        if not isinstance(digest, str) or not SHA256.fullmatch(digest):
            raise ValidationError(f"invalid output hash: {result_path}")
    if provider_hash != result["providerSourceSha256"] or candidate_hash != result["candidateSha256"]:
        raise ValidationError(f"output hash mismatch: {result_path}")
    if provider_hash != candidate_hash or provider_path.read_bytes() != candidate_path.read_bytes():
        raise ValidationError(f"provider and candidate bytes differ: {result_path}")
    if png_dimensions(provider_path) != (1024, 1536) or png_dimensions(candidate_path) != (1024, 1536):
        raise ValidationError(f"output dimensions differ from contract: {result_path}")

    references = result["references"]
    if expected_kind == "summon":
        if not isinstance(references, list):
            raise ValidationError(f"summon references must be a list: {result_path}")
    else:
        if not isinstance(references, list) or len(references) != 1 or summon_source is None:
            raise ValidationError(f"chibi must contain exactly one summon reference: {result_path}")
        reference = references[0]
        if not isinstance(reference, dict) or set(reference) != {"role", "path", "sha256"}:
            raise ValidationError(f"chibi reference fields differ from contract: {result_path}")
        if (
            reference["role"] != "identity-anatomy-authority"
            or reference["path"] != summon_source[0]
            or reference["sha256"] != summon_source[1]
        ):
            raise ValidationError(f"chibi does not bind its summon source: {result_path}")
    return result["providerSourcePath"], provider_hash


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace-root", required=True, type=Path)
    parser.add_argument("--batch-root", required=True)
    arguments = parser.parse_args()

    workspace = arguments.workspace_root.resolve(strict=True)
    pure_batch = PurePosixPath(arguments.batch_root)
    if (
        pure_batch.is_absolute()
        or ".." in pure_batch.parts
        or pure_batch.parts[:3] != ("assets", "heroes", "experiments")
    ):
        raise ValidationError("batch root must remain under assets/heroes/experiments")
    batch_prefix = pure_batch.as_posix()
    manifest = read_json(workspace.joinpath(*pure_batch.parts, "manifest.json"))
    if manifest.get("schemaVersion") != "summonlab-hero-pair-batch-v1":
        raise ValidationError("unsupported batch schema")
    if manifest.get("status") != "candidate":
        raise ValidationError("batch must remain candidate-only")
    batch_id = manifest.get("batchId")
    heroes = manifest.get("heroes")
    if (
        not isinstance(batch_id, str)
        or not BATCH_ID.fullmatch(batch_id)
        or batch_id != pure_batch.name
    ):
        raise ValidationError("batchId must equal the batch directory name")
    if not isinstance(heroes, list) or not 1 <= len(heroes) <= 10 or manifest.get("count") != len(heroes):
        raise ValidationError("batch must contain 1 through 10 heroes and an exact count")

    seen: set[str] = set()
    for hero in heroes:
        if not isinstance(hero, dict) or set(hero) != {
            "heroId",
            "displayName",
            "briefPath",
            "summonResultPath",
            "chibiResultPath",
        }:
            raise ValidationError("hero manifest fields differ from contract")
        hero_id = hero["heroId"]
        if not isinstance(hero_id, str) or not HERO_ID.fullmatch(hero_id) or hero_id in seen:
            raise ValidationError(f"invalid or duplicate heroId: {hero_id}")
        seen.add(hero_id)
        brief = read_json(resolve_repo_path(workspace, hero["briefPath"], batch_prefix))
        brief_fields = {
            "schemaVersion",
            "heroId",
            "displayName",
            "nativeStars",
            "currentStars",
            "affinity",
            "identity",
            "physique",
            "hair",
            "wardrobe",
            "personalDetails",
            "characterKernel",
            "summonPrompt",
            "summonPromptSha256",
            "lifecycle",
            "exclusions",
        }
        if (
            set(brief) != brief_fields
            or brief.get("schemaVersion") != "summonlab-hero-visual-brief-v1"
            or brief.get("heroId") != hero_id
            or brief.get("displayName") != hero["displayName"]
            or brief.get("lifecycle") != "candidate"
        ):
            raise ValidationError(f"brief identity or lifecycle failed: {hero_id}")
        native_stars = brief.get("nativeStars")
        current_stars = brief.get("currentStars")
        if (
            isinstance(native_stars, bool)
            or not isinstance(native_stars, int)
            or native_stars not in range(1, 6)
            or current_stars != native_stars
            or brief.get("affinity") not in {"neutral", "fire", "water", "earth", "wind"}
        ):
            raise ValidationError(f"brief star or affinity contract failed: {hero_id}")
        for field in ("identity", "physique", "hair", "wardrobe", "personalDetails", "characterKernel"):
            if not isinstance(brief.get(field), dict) or not brief[field]:
                raise ValidationError(f"brief {field} must be a nonempty object: {hero_id}")
        if not isinstance(brief.get("exclusions"), list) or not all(
            isinstance(value, str) and value.strip() for value in brief["exclusions"]
        ):
            raise ValidationError(f"brief exclusions must be a text list: {hero_id}")
        summon_prompt = brief.get("summonPrompt")
        if (
            not isinstance(summon_prompt, str)
            or not summon_prompt.strip()
            or brief.get("summonPromptSha256")
            != hashlib.sha256(summon_prompt.encode("utf-8")).hexdigest()
        ):
            raise ValidationError(f"brief summon prompt hash failed: {hero_id}")
        summon_source = validate_result(
            workspace,
            batch_prefix,
            batch_id,
            hero_id,
            hero["summonResultPath"],
            "summon",
            None,
            summon_prompt,
        )
        validate_result(
            workspace,
            batch_prefix,
            batch_id,
            hero_id,
            hero["chibiResultPath"],
            "chibi",
            summon_source,
        )

    print(json.dumps({"batchId": batch_id, "heroes": len(heroes), "pairs": len(heroes), "status": "valid"}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
