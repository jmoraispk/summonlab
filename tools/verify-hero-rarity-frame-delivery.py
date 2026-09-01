#!/usr/bin/env python3
"""Replay canonical hero rarity-frame delivery checks without Node dependencies."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Iterable, Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen


CANONICAL_ROOT = Path("assets/heroes/visuals/rarity-frames")
REVIEW_PATH = "assets/heroes/visuals/rarity-frames/review/"
WIKI_ID = re.compile(r"^Wiki ID: `([^`]+)`\s*$", re.MULTILINE)

ALLOWED_SCOPE_PREFIXES = (
    "assets/heroes/visuals/rarity-frames/",
    "assets/heroes/visuals/rarity-frames-v1/",
    "assets/heroes/visuals/rarity-frames-v2/",
    "assets/heroes/visuals/rarity-frames-v3/",
    "assets/heroes/visuals/rarity-frames-v4/",
    "assets/heroes/visuals/rarity-frames-freeze-v1/",
)
ALLOWED_SCOPE_PATHS = frozenset(
    {
        "docs/decisions/0066-hero-rarity-frame-v3-v4-sources-are-frozen.md",
        "docs/decisions/0067-hero-rarity-frames-use-one-canonical-six-family-library.md",
        "docs/superpowers/plans/2026-09-01-canonical-hero-rarity-frames.md",
        "docs/superpowers/specs/2026-09-01-canonical-hero-rarity-frames-design.md",
        "docs/wiki/art/hero-rarity-frames.md",
        "tools/test_validate_hero_rarity_frames.py",
        "tools/test_verify_hero_rarity_frame_delivery.py",
        "tools/validate-hero-rarity-frames.py",
        "tools/verify-hero-rarity-frame-delivery.py",
    }
)


def manifest_asset_paths(manifest: Mapping[str, Any]) -> tuple[str, ...]:
    """Return manifest image paths in review order: sheet, then ranked frames."""

    paths: list[str] = []
    families = manifest.get("families")
    if not isinstance(families, list):
        return ()
    for family in families:
        if not isinstance(family, dict):
            continue
        sheet = family.get("sheet")
        if isinstance(sheet, dict) and isinstance(sheet.get("path"), str):
            paths.append(sheet["path"])
        frames = family.get("frames")
        if not isinstance(frames, list):
            continue
        for frame in frames:
            if isinstance(frame, dict) and isinstance(frame.get("path"), str):
                paths.append(frame["path"])
    return tuple(paths)


def http_paths(manifest: Mapping[str, Any]) -> tuple[str, ...]:
    """Return the review page followed by all manifest-bound PNG paths."""

    return (REVIEW_PATH, *manifest_asset_paths(manifest))


def scope_errors(changed_paths: Iterable[str]) -> list[str]:
    """Return deterministic violations of the approved migration-only diff scope."""

    errors: list[str] = []
    for path in sorted(set(changed_paths)):
        if path in ALLOWED_SCOPE_PATHS:
            continue
        if any(path.startswith(prefix) for prefix in ALLOWED_SCOPE_PREFIXES):
            continue
        errors.append(f"out-of-scope changed path: {path}")
    return errors


def wiki_catalog_errors(
    wiki_sources: Mapping[str, str],
    catalog: Mapping[str, Any],
) -> list[str]:
    """Compare every production Markdown Wiki ID with the catalog one-to-one."""

    errors: list[str] = []
    wiki_mapping: dict[str, str] = {}
    for path in sorted(wiki_sources):
        if "/templates/" in f"/{path}":
            continue
        matches = WIKI_ID.findall(wiki_sources[path])
        if len(matches) != 1:
            errors.append(f"production wiki page must declare exactly one Wiki ID: {path}")
            continue
        wiki_id = matches[0]
        if "replace-me" in wiki_id or wiki_id == "replace.with-stable-id":
            continue
        if wiki_id in wiki_mapping:
            errors.append(f"duplicate production Wiki ID: {wiki_id}")
        else:
            wiki_mapping[wiki_id] = path

    catalog_entries = catalog.get("entries") if isinstance(catalog, Mapping) else None
    if not isinstance(catalog_entries, list):
        return errors + ["wiki catalog must contain entries"]
    catalog_mapping: dict[str, str] = {}
    for index, entry in enumerate(catalog_entries):
        if not isinstance(entry, dict):
            errors.append(f"wiki catalog entry {index} must be an object")
            continue
        wiki_id = entry.get("wikiId")
        path = entry.get("path")
        if not isinstance(wiki_id, str) or not isinstance(path, str):
            errors.append(f"wiki catalog entry {index} must include wikiId and path")
            continue
        if wiki_id in catalog_mapping:
            errors.append(f"duplicate catalog Wiki ID: {wiki_id}")
        else:
            catalog_mapping[wiki_id] = path
    if wiki_mapping != catalog_mapping:
        errors.append("wiki/catalog ID-to-path mapping differs")
    return errors


def _load_wiki_sources(repository_root: Path) -> dict[str, str]:
    wiki_root = repository_root / "docs/wiki"
    sources: dict[str, str] = {}
    for path in sorted(wiki_root.rglob("*.md")):
        relative_path = path.relative_to(repository_root).as_posix()
        if "/templates/" in f"/{relative_path}":
            continue
        sources[relative_path] = path.read_text(encoding="utf-8")
    return sources


def _git_changed_paths(repository_root: Path, base_ref: str) -> tuple[str, ...]:
    result = subprocess.run(
        ["git", "diff", "--name-only", f"{base_ref}...HEAD"],
        cwd=repository_root,
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "git diff failed"
        raise RuntimeError(detail)
    return tuple(path for path in result.stdout.splitlines() if path)


def _http_errors(base_url: str, paths: Iterable[str]) -> list[str]:
    errors: list[str] = []
    normalized_base = base_url.rstrip("/") + "/"
    for path in paths:
        url = urljoin(normalized_base, path.lstrip("/"))
        request = Request(url, method="HEAD")
        try:
            with urlopen(request, timeout=15) as response:
                status = response.status
        except (HTTPError, URLError, TimeoutError, OSError) as exc:
            errors.append(f"HTTP check failed for {url}: {exc}")
            continue
        if status != 200:
            errors.append(f"HTTP check expected 200 for {url}, got {status}")
    return errors


def _read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Replay local wiki/scope checks and optional canonical HTTP delivery checks."
    )
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    parser.add_argument("--base-ref", default="origin/main")
    parser.add_argument("--base-url")
    args = parser.parse_args(list(argv) if argv is not None else None)

    repository_root = args.repo_root.resolve()
    errors: list[str] = []
    try:
        manifest = _read_json(repository_root / CANONICAL_ROOT / "manifest.json")
        catalog = _read_json(repository_root / "docs/wiki/catalog.json")
        wiki_sources = _load_wiki_sources(repository_root)
        changed_paths = _git_changed_paths(repository_root, args.base_ref)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, RuntimeError) as exc:
        print(f"delivery check setup failed: {exc}")
        return 1

    wiki_errors = wiki_catalog_errors(wiki_sources, catalog)
    errors.extend(wiki_errors)
    errors.extend(scope_errors(changed_paths))

    asset_paths = manifest_asset_paths(manifest)
    if len(asset_paths) != 48 or len(set(asset_paths)) != 48:
        errors.append("manifest must provide 48 unique HTTP asset paths")
    review_file = repository_root / REVIEW_PATH / "index.html"
    if not review_file.is_file():
        errors.append(f"missing local review page: {REVIEW_PATH}")

    if args.base_url:
        errors.extend(_http_errors(args.base_url, http_paths(manifest)))

    if errors:
        for error in errors:
            print(error)
        return 1

    production_ids = len(catalog.get("entries", []))
    print(f"PASS wiki/catalog parity: {production_ids} production IDs")
    print(f"PASS migration scope: {len(changed_paths)} changed paths")
    print("PASS local delivery paths: review page plus 48 manifest PNGs")
    if args.base_url:
        print(
            "PASS HTTP delivery: review page plus 48/48 manifest PNGs returned 200 via "
            f"{args.base_url.rstrip('/')}"
        )
    print("PASS hero rarity frame delivery")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
