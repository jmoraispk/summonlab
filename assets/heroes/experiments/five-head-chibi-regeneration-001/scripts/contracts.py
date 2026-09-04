#!/usr/bin/env python3
"""Immutable contracts for the five-head combat-chibi regeneration experiment."""

from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path
from typing import Any, Final, Literal, Mapping


EXPERIMENT_ID: Final = "five-head-chibi-regeneration-001"
EXPERIMENT_ROOT: Final = Path("assets/heroes/experiments") / EXPERIMENT_ID
SCHEMA_DECISION: Final = "five-head-chibi-regeneration-decision-v1"
SUPPORTED_SCHEMA_VERSIONS: Final = frozenset({SCHEMA_DECISION})

CANVAS_WIDTH: Final = 1024
CANVAS_HEIGHT: Final = 1536
CANVAS_MIME_TYPE: Final = "image/png"
RATIO_TARGET: Final = 5.0
PROMPT_VERSION: Final = "five-head-v1"
PROMPT_TEMPLATE_SHA256: Final = "9b25033627bd99830e3dee3a2da7526852bd51e7a5d73b502c93ab43377c348c"
SOURCE_ROSTER_PATH: Final = (
    "assets/heroes/experiments/one-star-overnight-200-001/review/review-manifest.json"
)
SOURCE_ROSTER_SHA256: Final = "8ae3ee617fb200018c261cdee7b2e3fb5a2f1d807cea77df2fe75b78464c6fe5"
UPSTREAM_COMPLETION_REPORT_SHA256: Final = "ce2534962da3c6e869cc3a18d26d6b88bd61ebfbef1a25915aabf0cdf4f370ef"
PRODUCTION_BASE_COMMIT: Final = "cfd84536c51a1df4a995d529efe71e6708b934ab"
WAVE_SIZES: Final = (16,) * 12 + (8,)
PRIMARY_CALL_LIMIT: Final = 200
RETRY_CALL_LIMIT: Final = 10
TOTAL_CALL_LIMIT: Final = PRIMARY_CALL_LIMIT + RETRY_CALL_LIMIT
LIFECYCLE: Final = "candidate"
PROMPT_SUBSTITUTIONS: Final = (
    "identity\nfacts",
    "body construction",
    "hair silhouette",
    "wardrobe construction and palette",
    "footwear",
    "durable accessories, tattoos, and markings",
)

SHA256_RE: Final = re.compile(r"^[a-f0-9]{64}$")
BRACKETED_FIELD_RE: Final = re.compile(r"\[([^\]]*)\]")


class ContractError(ValueError):
    """Raised when an immutable experiment contract is invalid."""


def _fail(message: str) -> None:
    raise ContractError(message)


def _require_sha256(value: object, field: str) -> str:
    if not isinstance(value, str) or SHA256_RE.fullmatch(value) is None:
        _fail(f"{field} must be a lowercase SHA-256 hex string")
    return value


def _validate_sha256_fields(value: object, field: str = "document") -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            child_field = f"{field}.{key}"
            if key.lower().endswith("sha256"):
                _require_sha256(child, child_field)
            else:
                _validate_sha256_fields(child, child_field)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            _validate_sha256_fields(child, f"{field}[{index}]")


def load_json(path: Path) -> dict:
    """Load a supported, object-shaped JSON contract with valid SHA-256 evidence."""
    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        _fail(f"cannot load JSON contract {path}: {error}")
    if not isinstance(parsed, dict):
        _fail("JSON contract must be an object")
    schema_version = parsed.get("schemaVersion")
    if schema_version not in SUPPORTED_SCHEMA_VERSIONS:
        _fail("JSON contract has an unsupported schemaVersion")
    _validate_sha256_fields(parsed)
    return parsed


def sha256_file(path: Path) -> str:
    """Return the SHA-256 digest of a regular file without loading it all at once."""
    if path.is_symlink() or not path.is_file():
        _fail(f"SHA-256 input must be a regular file: {path}")
    digest = hashlib.sha256()
    try:
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
    except OSError as error:
        _fail(f"cannot hash {path}: {error}")
    return digest.hexdigest()


def confine_relative(root: Path, value: str) -> Path:
    """Resolve a relative path only when it stays inside ``root`` without symlink escapes."""
    if not isinstance(value, str) or not value:
        _fail("relative path must be a non-empty string")
    supplied = Path(value)
    if supplied.is_absolute() or ".." in supplied.parts:
        _fail("path must be relative and must not contain '..'")
    resolved_root = root.resolve(strict=True)
    candidate = (resolved_root / supplied).resolve(strict=False)
    try:
        candidate.relative_to(resolved_root)
    except ValueError:
        _fail("path escapes its confined root")
    return candidate


def exclusive_write(path: Path, data: bytes) -> Literal["created", "already-identical"]:
    """Create ``path`` once, accepting only an already-present identical payload."""
    if not isinstance(data, bytes):
        _fail("exclusive writes require bytes")
    path.parent.mkdir(parents=True, exist_ok=True)
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    try:
        descriptor = os.open(path, flags, 0o644)
    except FileExistsError:
        if path.is_symlink() or not path.is_file():
            _fail(f"occupied path is not a regular file: {path}")
        try:
            existing = path.read_bytes()
        except OSError as error:
            _fail(f"cannot read occupied path {path}: {error}")
        if existing == data:
            return "already-identical"
        _fail(f"occupied path has different bytes: {path}")
    except OSError as error:
        _fail(f"cannot exclusively create {path}: {error}")
    with os.fdopen(descriptor, "wb") as handle:
        handle.write(data)
        handle.flush()
        os.fsync(handle.fileno())
    return "created"


def render_prompt(template: str, substitutions: Mapping[str, str]) -> str:
    """Render precisely the six frozen fields and reject every remaining bracket."""
    if not isinstance(template, str):
        _fail("prompt template must be text")
    if set(substitutions) != set(PROMPT_SUBSTITUTIONS):
        _fail("prompt substitutions must be exactly the six frozen fields")
    fields = BRACKETED_FIELD_RE.findall(template)
    if set(fields) != set(PROMPT_SUBSTITUTIONS) or len(fields) != len(PROMPT_SUBSTITUTIONS):
        _fail("prompt template has unsupported bracket substitutions")
    rendered = template
    for field in PROMPT_SUBSTITUTIONS:
        value = substitutions[field]
        if not isinstance(value, str) or "[" in value or "]" in value:
            _fail(f"prompt substitution {field!r} is invalid")
        rendered = rendered.replace(f"[{field}]", value)
    if "[" in rendered or "]" in rendered:
        _fail("rendered prompt contains unresolved brackets")
    return rendered
