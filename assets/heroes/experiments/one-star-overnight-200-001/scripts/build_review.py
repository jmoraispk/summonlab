#!/usr/bin/env python3
"""Build immutable review derivatives and static pair-review pages.

This coordinator-only tool reads validated candidate artifacts, creates fixed-canvas WebP
derivatives, and writes review-only HTML plus a hash manifest. It never edits candidates,
results, targets, the roster, production reports, journals, or runtime catalogs.
"""

from __future__ import annotations

import argparse
from copy import deepcopy
import html
import json
import os
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any, Iterable

from PIL import Image, ImageOps

from contracts import (
    ContractError,
    EXPERIMENT_ID,
    EXPERIMENT_ROOT,
    anchored_read,
    ensure_no_symlink_path,
    sha256_bytes,
    sha256_json,
    validate_repo_path,
)
from validate_wave import verify_execution
from activate_reserve import _activation_files, _current_selection


REVIEW_ROOT = f"{EXPERIMENT_ROOT}/review"
REVIEW_MANIFEST = f"{REVIEW_ROOT}/review-manifest.json"
REFERENCE_SHELF = f"{REVIEW_ROOT}/reference-shelf.json"
PAGE_SIZE = 20
CANVAS = (512, 768)
WEBP_QUALITY = 82
SLUG_RE = re.compile(r"^[a-z][a-z0-9-]{1,79}$")


@dataclass(frozen=True)
class Artifact:
    hero_id: str
    kind: str
    version: int
    target: dict[str, Any]
    result: dict[str, Any]
    source_path: str | None
    source_sha256: str | None
    source_bytes: int | None


@dataclass(frozen=True)
class Pair:
    roster: dict[str, Any]
    summon: Artifact
    chibi: Artifact


@dataclass(frozen=True)
class QuarantineEntry:
    roster: dict[str, Any]
    reasons: tuple[str, ...]
    artifacts: tuple[Artifact, ...]


def _load_json_bytes(workspace: Path, relative: str, *, prefix: str = EXPERIMENT_ROOT) -> Any:
    payload = anchored_read(workspace, relative, prefix=prefix)
    try:
        return json.loads(payload)
    except json.JSONDecodeError as error:
        raise ContractError(f"cannot parse JSON {relative}: {error}") from error


def _atomic_write(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.is_symlink():
        raise ContractError(f"refusing to replace symlink: {path}")
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix=f".{path.name}.", delete=False) as handle:
        temp = Path(handle.name)
        handle.write(payload)
        handle.flush()
        os.fsync(handle.fileno())
    try:
        os.replace(temp, path)
    finally:
        if temp.exists():
            temp.unlink()


def _write_derivative_exclusive(path: Path, payload: bytes) -> None:
    """Create once, or accept an identical deterministic rerun; never replace bytes."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if path.is_symlink() or not path.is_file():
            raise ContractError(f"review derivative is not a regular file: {path}")
        existing = path.read_bytes()
        if existing != payload:
            raise ContractError(f"review derivative collision with different bytes: {path}")
        return
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    descriptor = os.open(path, flags, 0o644)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
    except Exception:
        try:
            path.unlink()
        except FileNotFoundError:
            pass
        raise


def _validate_roster_entry(entry: Any, expected_status: str) -> dict[str, Any]:
    if not isinstance(entry, dict):
        raise ContractError("roster entry must be an object")
    hero_id = entry.get("heroId")
    if not isinstance(hero_id, str) or not SLUG_RE.fullmatch(hero_id):
        raise ContractError("roster heroId must be a lowercase slug")
    if entry.get("rosterStatus") != expected_status:
        raise ContractError(f"roster status mismatch for {hero_id}")
    if not isinstance(entry.get("displayName"), str) or not entry["displayName"].strip():
        raise ContractError(f"roster displayName missing for {hero_id}")
    physical = entry.get("physicalManifest")
    quota = entry.get("quotaCoordinates")
    if not isinstance(physical, dict) or not isinstance(quota, dict):
        raise ContractError(f"roster metadata missing for {hero_id}")
    ordinal = physical.get("designOrdinal")
    if isinstance(ordinal, bool) or not isinstance(ordinal, int) or ordinal < 1:
        raise ContractError(f"invalid design ordinal for {hero_id}")
    return entry


def load_effective_roster(workspace: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    roster_relative = f"{EXPERIMENT_ROOT}/roster-plan.json"
    roster = _load_json_bytes(workspace, roster_relative)
    if not isinstance(roster, dict) or roster.get("experimentId") != EXPERIMENT_ID:
        raise ContractError("roster-plan.json has the wrong experiment")
    active = [_validate_roster_entry(entry, "active") for entry in roster.get("active", [])]
    reserves = [_validate_roster_entry(entry, "reserve") for entry in roster.get("reserves", [])]
    if len({entry["heroId"] for entry in active + reserves}) != len(active) + len(reserves):
        raise ContractError("roster contains duplicate hero IDs")

    activation_summary: dict[str, Any] = {
        "paths": [],
        "chainHeadSha256": None,
        "count": 0,
        "replacements": [],
    }
    activation_files = _activation_files(workspace)
    if activation_files:
        selection, _used_reserves, _used_slots, chain_head, count = _current_selection(workspace, roster)
        active_by_id = {entry["heroId"]: entry for entry in active}
        reserve_by_id = {entry["heroId"]: entry for entry in reserves}
        record_by_slot: dict[str, tuple[str, dict[str, Any]]] = {}
        activation_paths: list[dict[str, str]] = []
        for relative in activation_files:
            payload = anchored_read(workspace, relative)
            try:
                record = json.loads(payload)
            except json.JSONDecodeError as error:
                raise ContractError(f"cannot parse activation record {relative}: {error}") from error
            record_by_slot[record["failedActiveHeroId"]] = (relative, record)
            activation_paths.append({"path": relative, "sha256": sha256_bytes(payload)})
        effective: list[dict[str, Any]] = []
        replacements: list[dict[str, str]] = []
        for selection_entry in selection:
            slot_id = selection_entry["slotHeroId"]
            selected_id = selection_entry["selectedHeroId"]
            if selected_id == slot_id:
                effective.append(active_by_id[slot_id])
                continue
            if selected_id not in reserve_by_id or slot_id not in record_by_slot:
                raise ContractError("activation selection does not resolve to a frozen reserve and record")
            _relative, record = record_by_slot[slot_id]
            if record["reserveHeroId"] != selected_id:
                raise ContractError("activation record and active selection disagree")
            packet = deepcopy(reserve_by_id[selected_id])
            packet["rosterStatus"] = "active"
            packet["waveId"] = record["destinationWave"]
            packet["physicalManifest"] = deepcopy(record["physicalManifest"])
            packet["quotaCoordinates"] = deepcopy(record["slotQuotaCoordinates"])
            packet["displayName"] = record["preservedReserveIdentity"]["displayName"]
            effective.append(packet)
            replacements.append({"reserveHeroId": selected_id, "replacesHeroId": slot_id})
        active = effective
        activation_summary = {
            "paths": activation_paths,
            "chainHeadSha256": chain_head,
            "count": count,
            "replacements": replacements,
        }
    active.sort(key=lambda entry: (entry["physicalManifest"]["designOrdinal"], entry["heroId"]))
    return active, activation_summary


def collect_executions(workspace: Path, roster: Iterable[dict[str, Any]]) -> dict[str, list[Artifact]]:
    allowed = {entry["heroId"] for entry in roster}
    collected: dict[str, list[Artifact]] = {hero_id: [] for hero_id in allowed}
    targets_root = workspace / EXPERIMENT_ROOT / "waves"
    for target_path in sorted(targets_root.glob("wave-*/targets/*/*.json")):
        target_relative = target_path.relative_to(workspace).as_posix()
        target_payload = _load_json_bytes(workspace, target_relative)
        hero_id = target_payload.get("heroId") if isinstance(target_payload, dict) else None
        if hero_id not in allowed:
            continue
        result_relative = target_payload.get("output", {}).get("resultPath")
        if not isinstance(result_relative, str):
            raise ContractError(f"target lacks result path: {target_relative}")
        result_absolute = workspace / result_relative
        if not result_absolute.exists():
            continue
        execution = verify_execution(workspace, target_relative)
        target = execution["target"]
        result = execution["result"]
        candidate = result.get("candidate")
        collected[hero_id].append(
            Artifact(
                hero_id=hero_id,
                kind=target["imageKind"],
                version=target["targetVersion"],
                target=target,
                result=result,
                source_path=candidate["path"] if candidate else None,
                source_sha256=candidate["sha256"] if candidate else None,
                source_bytes=candidate["bytes"] if candidate else None,
            )
        )
    return collected


def select_pairs(
    roster: list[dict[str, Any]], artifacts_by_hero: dict[str, list[Artifact]]
) -> tuple[list[Pair], list[QuarantineEntry]]:
    pairs: list[Pair] = []
    quarantine: list[QuarantineEntry] = []
    for entry in roster:
        hero_id = entry["heroId"]
        artifacts = artifacts_by_hero.get(hero_id, [])
        if not artifacts:
            # A not-yet-produced roster slot is pending, not quarantined.
            continue
        candidate_by_kind: dict[str, list[Artifact]] = {"summon": [], "combat-chibi": []}
        noncandidate: list[Artifact] = []
        for artifact in artifacts:
            if artifact.result["status"] == "candidate" and artifact.source_path is not None:
                candidate_by_kind[artifact.kind].append(artifact)
            else:
                noncandidate.append(artifact)
        selected: dict[str, Artifact | None] = {}
        for kind, candidates in candidate_by_kind.items():
            versions = [artifact.version for artifact in candidates]
            if len(versions) != len(set(versions)):
                raise ContractError(f"ambiguous duplicate candidate versions for {hero_id} {kind}")
            selected[kind] = max(candidates, key=lambda artifact: artifact.version) if candidates else None

        summon = selected["summon"]
        chibi = selected["combat-chibi"]
        reasons: list[str] = []
        if summon is None:
            reasons.append("No candidate-status summon")
        if chibi is None:
            reasons.append("No candidate-status combat chibi")
        if summon is not None and chibi is not None:
            if sha256_json(summon.target["heroSpec"]) != sha256_json(chibi.target["heroSpec"]):
                reasons.append("Selected summon and chibi hero specifications differ")
            source = chibi.target["sourceSummon"]
            if not source or (
                source["targetId"] != summon.target["targetId"]
                or source["candidatePath"] != summon.source_path
                or source["sha256"] != summon.source_sha256
                or source["resultPath"] != summon.target["output"]["resultPath"]
            ):
                reasons.append("Selected chibi does not bind the selected summon")
        if reasons:
            reasons.extend(
                f"{artifact.kind} v{artifact.version} status: {artifact.result['status']}"
                for artifact in noncandidate
            )
            visible_by_key = {
                (artifact.kind, artifact.version): artifact
                for artifact in noncandidate + [item for item in (summon, chibi) if item]
                if artifact.source_path is not None
            }
            visible = tuple(sorted(visible_by_key.values(), key=lambda a: (a.kind, a.version)))
            quarantine.append(QuarantineEntry(entry, tuple(reasons), visible))
        else:
            assert summon is not None and chibi is not None
            pairs.append(Pair(entry, summon, chibi))
            visible_noncandidate = tuple(
                sorted(
                    (artifact for artifact in noncandidate if artifact.source_path is not None),
                    key=lambda a: (a.kind, a.version),
                )
            )
            if visible_noncandidate:
                quarantine.append(
                    QuarantineEntry(
                        entry,
                        ("Superseded revise/failed attempt retained for provenance",),
                        visible_noncandidate,
                    )
                )
    return pairs, quarantine


def discover_review_state(
    workspace: Path,
) -> tuple[
    list[dict[str, Any]],
    dict[str, Any],
    dict[str, list[Artifact]],
    list[Pair],
    list[QuarantineEntry],
]:
    """Resolve effective selection while retaining replaced-slot evidence off the main pages."""
    roster, activations = load_effective_roster(workspace)
    frozen = _load_json_bytes(workspace, f"{EXPERIMENT_ROOT}/roster-plan.json")
    frozen_active = {entry["heroId"]: entry for entry in frozen["active"]}
    retired: list[tuple[dict[str, Any], str]] = []
    for replacement in activations["replacements"]:
        failed_id = replacement["replacesHeroId"]
        if failed_id not in frozen_active:
            raise ContractError(f"activation references unknown frozen active slot: {failed_id}")
        retired.append((frozen_active[failed_id], replacement["reserveHeroId"]))
    artifacts_by_hero = collect_executions(
        workspace, roster + [entry for entry, _replacement_id in retired]
    )
    pairs, quarantine = select_pairs(roster, artifacts_by_hero)
    for entry, replacement_id in retired:
        visible = tuple(
            sorted(
                (
                    artifact
                    for artifact in artifacts_by_hero.get(entry["heroId"], [])
                    if artifact.source_path is not None
                ),
                key=lambda artifact: (artifact.kind, artifact.version),
            )
        )
        quarantine.append(
            QuarantineEntry(
                entry,
                (
                    f"Deactivated active quota slot; replaced by reserve {replacement_id}",
                    "Retained only as failed-slot review evidence; not eligible for the current 200",
                ),
                visible,
            )
        )
    quarantine.sort(
        key=lambda item: (
            item.roster["physicalManifest"]["designOrdinal"],
            item.roster["heroId"],
            item.reasons,
        )
    )
    return roster, activations, artifacts_by_hero, pairs, quarantine


def _webp_bytes(source: bytes) -> bytes:
    from io import BytesIO

    with Image.open(BytesIO(source)) as opened:
        image = ImageOps.exif_transpose(opened).convert("RGB")
        contained = ImageOps.contain(image, CANVAS, method=Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", CANVAS, "#e8dfcf")
        left = (CANVAS[0] - contained.width) // 2
        top = (CANVAS[1] - contained.height) // 2
        canvas.paste(contained, (left, top))
        output = BytesIO()
        canvas.save(output, "WEBP", quality=WEBP_QUALITY, method=6, exact=True)
        return output.getvalue()


def _derivative_path(artifact: Artifact, *, shelf_id: str | None = None) -> str:
    if shelf_id:
        return f"{REVIEW_ROOT}/derivatives/reference-shelf/{shelf_id}/{artifact.kind}.webp"
    wave = artifact.target["waveId"]
    return f"{REVIEW_ROOT}/derivatives/{wave}/{artifact.hero_id}/{artifact.kind}-v{artifact.version}.webp"


def materialize_derivative(
    workspace: Path, artifact: Artifact, *, shelf_id: str | None = None
) -> dict[str, Any]:
    if artifact.source_path is None or artifact.source_sha256 is None or artifact.source_bytes is None:
        raise ContractError("cannot create a derivative for an artifact without candidate bytes")
    source = anchored_read(workspace, artifact.source_path)
    if len(source) != artifact.source_bytes or sha256_bytes(source) != artifact.source_sha256:
        raise ContractError(f"candidate bytes drifted before review conversion: {artifact.source_path}")
    before = artifact.source_sha256
    payload = _webp_bytes(source)
    relative = _derivative_path(artifact, shelf_id=shelf_id)
    absolute = ensure_no_symlink_path(workspace, relative, allow_missing_leaf=True)
    _write_derivative_exclusive(absolute, payload)
    if sha256_bytes(anchored_read(workspace, artifact.source_path)) != before:
        raise ContractError(f"candidate bytes changed during review conversion: {artifact.source_path}")
    return {
        "path": relative,
        "sha256": sha256_bytes(payload),
        "bytes": len(payload),
        "width": CANVAS[0],
        "height": CANVAS[1],
        "mediaType": "image/webp",
        "sourcePath": artifact.source_path,
        "sourceSha256": artifact.source_sha256,
    }


def _reference_artifact(workspace: Path, shelf_id: str, kind: str, item: Any) -> Artifact:
    if not isinstance(item, dict) or set(item) != {"path", "sha256"}:
        raise ContractError(f"reference shelf {shelf_id} {kind} must contain path and sha256")
    path = validate_repo_path(item["path"], f"reference shelf {shelf_id} {kind}.path", prefix="assets")
    digest = item["sha256"]
    if not isinstance(digest, str) or not re.fullmatch(r"[a-f0-9]{64}", digest):
        raise ContractError(f"reference shelf {shelf_id} {kind} sha256 is invalid")
    payload = anchored_read(workspace, path, prefix="assets")
    if sha256_bytes(payload) != digest:
        raise ContractError(f"reference shelf source drifted: {path}")
    return Artifact(shelf_id, kind, 1, {"waveId": "reference-shelf"}, {"status": "reference"}, path, digest, len(payload))


def load_reference_shelf(workspace: Path) -> list[dict[str, Any]]:
    absolute = workspace / REFERENCE_SHELF
    if not absolute.exists():
        return []
    config = _load_json_bytes(workspace, REFERENCE_SHELF)
    if not isinstance(config, dict) or config.get("schemaVersion") != "hero-one-star-reference-shelf-v1":
        raise ContractError("reference shelf schemaVersion is invalid")
    entries = config.get("entries")
    if not isinstance(entries, list):
        raise ContractError("reference shelf entries must be an array")
    parsed: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict) or set(entry) != {"referenceId", "displayName", "note", "summon", "combatChibi"}:
            raise ContractError(f"reference shelf entry {index} has invalid fields")
        shelf_id = entry["referenceId"]
        if not isinstance(shelf_id, str) or not SLUG_RE.fullmatch(shelf_id) or shelf_id in seen:
            raise ContractError(f"reference shelf entry {index} has invalid or duplicate referenceId")
        seen.add(shelf_id)
        if not all(isinstance(entry[key], str) and entry[key].strip() for key in ("displayName", "note")):
            raise ContractError(f"reference shelf entry {index} lacks display text")
        parsed.append(
            {
                **entry,
                "summonArtifact": _reference_artifact(workspace, shelf_id, "summon", entry["summon"]),
                "chibiArtifact": _reference_artifact(workspace, shelf_id, "combat-chibi", entry["combatChibi"]),
            }
        )
    return parsed


def _relative_href(from_relative: str, to_relative: str) -> str:
    return os.path.relpath(to_relative, PurePosixPath(from_relative).parent.as_posix()).replace(os.sep, "/")


def _escape(value: Any) -> str:
    return html.escape(str(value), quote=True)


def _metadata(entry: dict[str, Any]) -> dict[str, str]:
    quota = entry["quotaCoordinates"]
    physical = entry["physicalManifest"]
    return {
        "gender": quota["gender"],
        "body": quota["body"],
        "hair": quota["hairColor"],
        "wardrobe": quota["wardrobe"],
        "palette": quota["palette"],
        "height": quota["height"],
        "age": quota["ageBand"],
        "wave": entry["waveId"],
        "details": quota["detailDensity"],
        "name": entry["displayName"],
        "ageYears": str(physical["adultAge"]),
    }


CSS = r"""
:root{color-scheme:dark;--ink:#f4ead8;--muted:#b8ab97;--black:#11191b;--panel:#182225;--panel2:#202c2f;--line:#455356;--amber:#e7b75f;--paper:#e8dfcf;--danger:#e08b78;--focus:#77d5e6;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#11191b;color:#f4ead8}*{box-sizing:border-box}html{scrollbar-color:#637174 #11191b;scrollbar-gutter:stable}body{margin:0;background:linear-gradient(120deg,#11191b,#182225 60%,#11191b);min-height:100vh}a{color:inherit}a:focus-visible,select:focus-visible,input:focus-visible{outline:3px solid var(--focus);outline-offset:3px}.mast{padding:clamp(2rem,5vw,5rem);border-bottom:1px solid var(--line);background:radial-gradient(circle at 70% 0,#2e3d3d 0,transparent 42rem)}.kicker{margin:0 0 .65rem;color:var(--amber);font:800 .72rem/1.2 ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase}.mast h1{max-width:14ch;margin:0;font:500 clamp(2.8rem,7vw,6.5rem)/.9 Georgia,serif;letter-spacing:-.045em}.mast-copy{max-width:53rem;margin:1.3rem 0 0;color:var(--muted);font-size:1.02rem;line-height:1.65}.counts{display:flex;flex-wrap:wrap;gap:.55rem;margin-top:1.5rem}.count{padding:.55rem .7rem;border:1px solid var(--line);background:#11191baa;font:700 .76rem/1 ui-monospace,monospace}.bar{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;gap:.65rem;align-items:end;padding:.85rem clamp(.75rem,3vw,3rem);border-bottom:1px solid var(--line);background:#11191bf2;backdrop-filter:blur(12px)}.filter{display:grid;gap:.3rem}.filter label{color:var(--muted);font:700 .64rem/1 ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em}.filter select,.filter input{min-height:2.4rem;border:1px solid var(--line);border-radius:0;background:var(--panel);color:var(--ink);padding:.45rem .6rem;font:650 .8rem/1 system-ui}.filter input{width:12rem}.nav{display:flex;flex-wrap:wrap;gap:.45rem;margin-left:auto}.nav a{display:inline-flex;align-items:center;min-height:2.4rem;padding:.45rem .65rem;border:1px solid var(--line);text-decoration:none;font:700 .75rem/1 ui-monospace,monospace}.nav a:hover{border-color:var(--amber);background:var(--panel2)}main{padding:clamp(1rem,3vw,3rem);max-width:118rem;margin:auto}.page-note{display:flex;justify-content:space-between;gap:1rem;margin:0 0 1rem;color:var(--muted);font:.78rem/1.4 ui-monospace,monospace}.grid{display:grid;gap:1.15rem}.card{border:1px solid var(--line);background:var(--panel);box-shadow:0 1.3rem 3rem #0004;overflow-x:auto}.pair{display:grid;grid-template-columns:1fr 1fr;min-width:44rem;min-height:36rem;background:#0e1517}.art{position:relative;display:block;min-width:0;background:#151d1f}.art+ .art{border-left:1px solid var(--line)}.art img{display:block;width:100%;height:min(62vw,48rem);object-fit:contain}.view{position:absolute;left:.75rem;top:.75rem;padding:.38rem .5rem;background:#11191be8;border:1px solid #738184;color:var(--ink);font:800 .66rem/1 ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase}.card-foot{display:grid;grid-template-columns:minmax(12rem,.6fr) 1fr;gap:1rem;padding:1rem 1.15rem;border-top:1px solid var(--line)}.name h2{margin:0;font:500 1.55rem/1.05 Georgia,serif}.name p{margin:.35rem 0 0;color:var(--muted);font:.72rem/1.4 ui-monospace,monospace}.tags{display:flex;flex-wrap:wrap;justify-content:flex-end;align-content:start;gap:.38rem}.tag{padding:.34rem .45rem;border:1px solid #526165;background:var(--panel2);font:700 .66rem/1 ui-monospace,monospace;color:#d9d0c1}.empty{padding:4rem 1rem;text-align:center;color:var(--muted);border:1px dashed var(--line)}.quarantine .card{border-color:#735047}.reasons{margin:.4rem 0 0;color:var(--danger);font:.8rem/1.5 system-ui}.artifact-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));background:#0e1517}.artifact-grid .art img{height:32rem}.shelf-note{padding:1rem 1.15rem;color:var(--muted);line-height:1.55}.hidden{display:none!important}@media(max-width:760px){.card-foot{grid-template-columns:1fr;min-width:44rem}.tags{justify-content:flex-start}.bar{position:static}.filter{flex:1 1 8rem}.filter input{width:100%}.nav{width:100%;margin-left:0}.page-note{display:block}}@media(prefers-reduced-motion:no-preference){.card{transition:border-color .15s ease,transform .15s ease}.card:hover{border-color:#728083;transform:translateY(-1px)}}@media(forced-colors:active){*{forced-color-adjust:auto}}
"""


JS = r"""
const controls=[...document.querySelectorAll('[data-filter]')];const cards=[...document.querySelectorAll('[data-card]')];const count=document.querySelector('[data-visible-count]');function apply(){const values=Object.fromEntries(controls.map(el=>[el.dataset.filter,el.value.trim().toLowerCase()]));let visible=0;for(const card of cards){const ok=Object.entries(values).every(([key,value])=>!value||(key==='search'?card.dataset.search.includes(value):card.dataset[key]===value));card.classList.toggle('hidden',!ok);if(ok)visible++}if(count)count.textContent=String(visible)}for(const control of controls){control.addEventListener(control.tagName==='INPUT'?'input':'change',apply)}apply();
"""


def _shell(title: str, body: str, *, current: str, counts: dict[str, int], filters: bool) -> str:
    filter_html = ""
    if filters:
        options = [
            ("gender", "Gender"), ("body", "Body"), ("hair", "Hair"),
            ("wardrobe", "Wardrobe"), ("palette", "Palette"), ("wave", "Wave"),
        ]
        selects = "".join(
            f'<div class="filter"><label for="f-{key}">{label}</label><select id="f-{key}" data-filter="{key}"><option value="">All</option></select></div>'
            for key, label in options
        )
        filter_html = f'<div class="filter"><label for="f-search">Find hero</label><input id="f-search" data-filter="search" type="search" autocomplete="off" placeholder="Name or tag"></div>{selects}'
    nav = '<nav class="nav" aria-label="Review sections"><a href="index.html">Candidate pairs</a><a href="reference-shelf.html">Reference shelf</a><a href="quarantine.html">Quarantine</a></nav>'
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{_escape(title)} · Summonlab</title><style>{CSS}</style></head><body><header class="mast"><p class="kicker">Candidate-only · no runtime promotion</p><h1>{_escape(title)}</h1><p class="mast-copy">Summon art and its source-bound combat chibi stay together. Every preview is a fixed-canvas review derivative; click either image to inspect the immutable full-resolution candidate.</p><div class="counts"><span class="count">{counts['complete']} / {counts['planned']} complete pairs</span><span class="count">{counts.get('started', counts['complete'])} started</span><span class="count">{counts.get('pending', counts['planned'] - counts['complete'])} pending</span><span class="count">{counts['quarantine']} quarantine records</span><span class="count">{counts['reserves']} reserve activations</span><span class="count"><span data-visible-count>{counts.get('page', 0)}</span> visible here</span></div></header><div class="bar">{filter_html}{nav}</div>{body}<script>{_options_script() if filters else ''}{JS if filters else ''}</script></body></html>'''


def _options_script() -> str:
    return r"""for(const select of document.querySelectorAll('select[data-filter]')){const key=select.dataset.filter;const values=[...new Set([...document.querySelectorAll('[data-card]')].map(card=>card.dataset[key]).filter(Boolean))].sort();for(const value of values){const option=document.createElement('option');option.value=value;option.textContent=value.replaceAll('-',' ');select.append(option)}}"""


def _art_link(page_path: str, derivative: dict[str, Any], label: str) -> str:
    preview = _relative_href(page_path, derivative["path"])
    source = _relative_href(page_path, derivative["sourcePath"])
    return f'<a class="art" href="{_escape(source)}" data-view="{_escape(label)}" aria-label="Open full-resolution {_escape(label)}"><span class="view">{_escape(label)} · full source</span><img src="{_escape(preview)}" width="512" height="768" loading="lazy" alt=""></a>'


def _pair_card(page_path: str, pair: Pair, derivatives: dict[tuple[str, str, int], dict[str, Any]]) -> str:
    meta = _metadata(pair.roster)
    attrs = " ".join(f'data-{key}="{_escape(value.lower())}"' for key, value in meta.items() if key not in {"name", "ageYears"})
    search = " ".join(meta.values()).lower()
    summon = derivatives[(pair.summon.hero_id, pair.summon.kind, pair.summon.version)]
    chibi = derivatives[(pair.chibi.hero_id, pair.chibi.kind, pair.chibi.version)]
    tags = [meta[key] for key in ("gender", "age", "height", "body", "hair", "wardrobe", "palette", "details")]
    return f'''<article class="card" data-card data-search="{_escape(search)}" {attrs}><div class="pair">{_art_link(page_path, summon, 'Summon')}{_art_link(page_path, chibi, 'Combat chibi')}</div><footer class="card-foot"><div class="name"><h2>{_escape(pair.roster['displayName'])}</h2><p>{_escape(pair.roster['heroId'])} · {meta['ageYears']} years · {meta['wave']} · summon v{pair.summon.version} / chibi v{pair.chibi.version}</p></div><div class="tags">{''.join(f'<span class="tag">{_escape(tag)}</span>' for tag in tags)}</div></footer></article>'''


def _render_pair_page(page_path: str, pairs: list[Pair], derivatives: dict[tuple[str, str, int], dict[str, Any]], page_number: int, total_pages: int, counts: dict[str, int]) -> str:
    cards = "".join(_pair_card(page_path, pair, derivatives) for pair in pairs)
    if not cards:
        cards = '<div class="empty">No complete candidate-status pairs are available yet. Run production first, then rebuild this review.</div>'
    previous = "index.html" if page_number == 2 else f"page-{page_number - 1:02d}.html"
    next_page = f"page-{page_number + 1:02d}.html"
    pager = []
    if page_number > 1:
        pager.append(f'<a href="{previous}">← Previous 20</a>')
    if page_number < total_pages:
        pager.append(f'<a href="{next_page}">Next 20 →</a>')
    page_counts = {**counts, "page": len(pairs)}
    body = f'<main><div class="page-note"><span>Page {page_number} of {max(total_pages, 1)} · stable roster order</span><span>{" · ".join(pager) if pager else "Current complete set"}</span></div><section class="grid" aria-label="Hero candidate pairs">{cards}</section></main>'
    return _shell("The one-star casting board", body, current="pairs", counts=page_counts, filters=True)


def _quarantine_card(page_path: str, entry: QuarantineEntry, derivatives: dict[tuple[str, str, int], dict[str, Any]]) -> str:
    meta = _metadata(entry.roster)
    attrs = " ".join(f'data-{key}="{_escape(value.lower())}"' for key, value in meta.items() if key not in {"name", "ageYears"})
    arts = []
    for artifact in entry.artifacts:
        derivative = derivatives[(artifact.hero_id, artifact.kind, artifact.version)]
        arts.append(_art_link(page_path, derivative, f"{artifact.kind} v{artifact.version} · {artifact.result['status']}"))
    art_html = "".join(arts) or '<div class="empty">No image candidate has been persisted for this hero.</div>'
    reasons = "".join(f"<li>{_escape(reason)}</li>" for reason in entry.reasons)
    search = " ".join(meta.values()) + " " + " ".join(entry.reasons)
    return f'''<article class="card" data-card data-search="{_escape(search.lower())}" {attrs}><div class="artifact-grid">{art_html}</div><footer class="card-foot"><div class="name"><h2>{_escape(entry.roster['displayName'])}</h2><p>{_escape(entry.roster['heroId'])} · {meta['wave']}</p><ul class="reasons">{reasons}</ul></div><div class="tags"><span class="tag">{_escape(meta['body'])}</span><span class="tag">{_escape(meta['hair'])}</span><span class="tag">{_escape(meta['wardrobe'])}</span></div></footer></article>'''


def _render_quarantine(page_path: str, entries: list[QuarantineEntry], derivatives: dict[tuple[str, str, int], dict[str, Any]], counts: dict[str, int]) -> str:
    cards = "".join(_quarantine_card(page_path, entry, derivatives) for entry in entries)
    if not cards:
        cards = '<div class="empty">No incomplete, revise, failed, or superseded artifacts are currently retained.</div>'
    body = f'<main class="quarantine"><div class="page-note"><span>Problems and superseded attempts stay outside the candidate-pair pages.</span><span>Provenance is preserved.</span></div><section class="grid" aria-label="Quarantined production records">{cards}</section></main>'
    return _shell("Quarantine ledger", body, current="quarantine", counts={**counts, "page": len(entries)}, filters=True)


def _render_reference_shelf(page_path: str, entries: list[dict[str, Any]], derivatives: dict[tuple[str, str], dict[str, Any]], counts: dict[str, int]) -> str:
    cards: list[str] = []
    for entry in entries:
        summon = derivatives[(entry["referenceId"], "summon")]
        chibi = derivatives[(entry["referenceId"], "combat-chibi")]
        cards.append(f'''<article class="card"><div class="pair">{_art_link(page_path, summon, 'Reference summon')}{_art_link(page_path, chibi, 'Reference chibi')}</div><footer class="card-foot"><div class="name"><h2>{_escape(entry['displayName'])}</h2><p>{_escape(entry['referenceId'])}</p></div><p class="shelf-note">{_escape(entry['note'])}</p></footer></article>''')
    content = "".join(cards) or '<div class="empty">No reference-shelf configuration is present. Candidate pairs remain unaffected.</div>'
    body = f'<main><div class="page-note"><span>Previously reviewed examples are context, never part of the new 200.</span><span>{len(entries)} reference pairs</span></div><section class="grid" aria-label="Reference hero pairs">{content}</section></main>'
    return _shell("Reference shelf", body, current="reference", counts={**counts, "page": len(entries)}, filters=False)


def build_review(workspace: Path) -> dict[str, Any]:
    workspace = workspace.resolve(strict=True)
    roster, activations, artifacts_by_hero, pairs, quarantine = discover_review_state(workspace)
    references = load_reference_shelf(workspace)

    derivative_records: list[dict[str, Any]] = []
    pair_derivatives: dict[tuple[str, str, int], dict[str, Any]] = {}
    needed: dict[tuple[str, str, int], Artifact] = {}
    for pair in pairs:
        for artifact in (pair.summon, pair.chibi):
            needed[(artifact.hero_id, artifact.kind, artifact.version)] = artifact
    for entry in quarantine:
        for artifact in entry.artifacts:
            needed[(artifact.hero_id, artifact.kind, artifact.version)] = artifact
    for key, artifact in sorted(needed.items()):
        record = materialize_derivative(workspace, artifact)
        pair_derivatives[key] = record
        derivative_records.append(record)

    shelf_derivatives: dict[tuple[str, str], dict[str, Any]] = {}
    for entry in references:
        for key, artifact in (("summon", entry["summonArtifact"]), ("combat-chibi", entry["chibiArtifact"])):
            record = materialize_derivative(workspace, artifact, shelf_id=entry["referenceId"])
            shelf_derivatives[(entry["referenceId"], key)] = record
            derivative_records.append(record)

    page_count = max(1, (len(pairs) + PAGE_SIZE - 1) // PAGE_SIZE)
    started_heroes = sum(bool(artifacts_by_hero.get(entry["heroId"])) for entry in roster)
    counts = {
        "planned": len(roster),
        "complete": len(pairs),
        "started": started_heroes,
        "pending": len(roster) - started_heroes,
        "quarantine": len(quarantine),
        "reserves": activations["count"],
    }
    pages: dict[str, bytes] = {}
    for index in range(page_count):
        page_number = index + 1
        relative = f"{REVIEW_ROOT}/index.html" if page_number == 1 else f"{REVIEW_ROOT}/page-{page_number:02d}.html"
        segment = pairs[index * PAGE_SIZE : (index + 1) * PAGE_SIZE]
        pages[relative] = _render_pair_page(relative, segment, pair_derivatives, page_number, page_count, counts).encode("utf-8")
    quarantine_relative = f"{REVIEW_ROOT}/quarantine.html"
    pages[quarantine_relative] = _render_quarantine(quarantine_relative, quarantine, pair_derivatives, counts).encode("utf-8")
    reference_relative = f"{REVIEW_ROOT}/reference-shelf.html"
    pages[reference_relative] = _render_reference_shelf(reference_relative, references, shelf_derivatives, counts).encode("utf-8")
    for relative, payload in pages.items():
        absolute = ensure_no_symlink_path(workspace, relative, allow_missing_leaf=True)
        _atomic_write(absolute, payload)

    manifest = {
        "schemaVersion": "hero-one-star-review-manifest-v1",
        "experimentId": EXPERIMENT_ID,
        "candidateBoundary": "candidate-only; review derivatives do not imply approval or runtime promotion",
        "settings": {
            "pageSize": PAGE_SIZE,
            "canvasWidth": CANVAS[0],
            "canvasHeight": CANVAS[1],
            "format": "webp",
            "quality": WEBP_QUALITY,
        },
        "counts": {
            "effectiveRoster": len(roster),
            "startedHeroes": started_heroes,
            "pendingHeroes": len(roster) - started_heroes,
            "completePairs": len(pairs),
            "quarantineRecords": len(quarantine),
            "referencePairs": len(references),
            "derivatives": len(derivative_records),
            "pages": len(pages),
        },
        "reserveActivations": activations,
        "selectedPairs": [
            {
                "heroId": pair.roster["heroId"],
                "displayName": pair.roster["displayName"],
                "designOrdinal": pair.roster["physicalManifest"]["designOrdinal"],
                "waveId": pair.roster["waveId"],
                "summonTargetId": pair.summon.target["targetId"],
                "chibiTargetId": pair.chibi.target["targetId"],
                "summonSourceSha256": pair.summon.source_sha256,
                "chibiSourceSha256": pair.chibi.source_sha256,
            }
            for pair in pairs
        ],
        "quarantine": [
            {"heroId": entry.roster["heroId"], "reasons": list(entry.reasons)} for entry in quarantine
        ],
        "derivatives": sorted(derivative_records, key=lambda item: item["path"]),
        "pages": [
            {"path": relative, "sha256": sha256_bytes(payload), "bytes": len(payload)}
            for relative, payload in sorted(pages.items())
        ],
    }
    manifest_payload = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    manifest_path = ensure_no_symlink_path(workspace, REVIEW_MANIFEST, allow_missing_leaf=True)
    _atomic_write(manifest_path, manifest_payload)
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workspace", type=Path)
    parser.add_argument("--summary-only", action="store_true", help="Print selection counts without writing review outputs.")
    args = parser.parse_args()
    if args.summary_only:
        roster, activations, _artifacts, pairs, quarantine = discover_review_state(
            args.workspace.resolve(strict=True)
        )
        print(json.dumps({"effectiveRoster": len(roster), "completePairs": len(pairs), "quarantineRecords": len(quarantine), "reserveActivations": activations["count"]}, indent=2))
        return
    manifest = build_review(args.workspace)
    print(json.dumps(manifest["counts"], indent=2))


if __name__ == "__main__":
    main()
