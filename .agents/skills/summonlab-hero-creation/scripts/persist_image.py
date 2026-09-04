#!/usr/bin/env python3
"""Persist one exact provider PNG and a byte-identical hero candidate without overwrite."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import struct
from pathlib import Path, PurePosixPath


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
HERO_PREFIX = PurePosixPath("assets/heroes/experiments")


class PersistenceError(ValueError):
    """Raised when an image cannot be persisted safely."""


def png_dimensions(data: bytes) -> tuple[int, int]:
    if len(data) < 24 or data[:8] != PNG_SIGNATURE or data[12:16] != b"IHDR":
        raise PersistenceError("source must be a readable PNG with an IHDR chunk")
    width, height = struct.unpack(">II", data[16:24])
    return width, height


def destination_path(workspace: Path, value: str) -> Path:
    pure = PurePosixPath(value)
    if pure.is_absolute() or ".." in pure.parts or pure.parts[:3] != HERO_PREFIX.parts:
        raise PersistenceError("destination must remain under assets/heroes/experiments")
    destination = workspace.joinpath(*pure.parts)
    current = workspace
    for part in pure.parts[:-1]:
        current = current / part
        if current.is_symlink():
            raise PersistenceError(f"destination parent must not be a symlink: {current}")
    return destination


def exclusive_write(path: Path, data: bytes) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o644)
    except FileExistsError:
        if path.is_file() and not path.is_symlink() and path.read_bytes() == data:
            return "already-identical"
        raise PersistenceError(f"refusing to replace occupied path: {path}") from None
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
    except BaseException:
        path.unlink(missing_ok=True)
        raise
    return "created"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace-root", required=True, type=Path)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--provider-destination", required=True)
    parser.add_argument("--candidate-destination", required=True)
    arguments = parser.parse_args()

    workspace = arguments.workspace_root.resolve(strict=True)
    source = arguments.source.resolve(strict=True)
    data = source.read_bytes()
    dimensions = png_dimensions(data)
    if dimensions != (1024, 1536):
        raise PersistenceError(f"expected 1024x1536 PNG, received {dimensions[0]}x{dimensions[1]}")

    provider = destination_path(workspace, arguments.provider_destination)
    candidate = destination_path(workspace, arguments.candidate_destination)
    if provider == candidate:
        raise PersistenceError("provider and candidate destinations must differ")

    provider_status = exclusive_write(provider, data)
    try:
        candidate_status = exclusive_write(candidate, data)
    except BaseException:
        if provider_status == "created":
            provider.unlink(missing_ok=True)
        raise
    digest = hashlib.sha256(data).hexdigest()
    print(
        json.dumps(
            {
                "width": dimensions[0],
                "height": dimensions[1],
                "sha256": digest,
                "providerStatus": provider_status,
                "candidateStatus": candidate_status,
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
