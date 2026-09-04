#!/usr/bin/env python3
"""Freeze the source-bound five-head combat-chibi production queue."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import shutil
import tempfile
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Sequence

from contracts import (
    CANVAS_HEIGHT,
    CANVAS_MIME_TYPE,
    CANVAS_WIDTH,
    ContractError,
    EXPERIMENT_ID,
    EXPERIMENT_ROOT,
    LIFECYCLE,
    PROMPT_TEMPLATE_SHA256,
    PROMPT_SUBSTITUTIONS,
    PROMPT_VERSION,
    SOURCE_ROSTER_PATH,
    SOURCE_ROSTER_SHA256,
    WAVE_SIZES,
    exclusive_write,
    render_prompt,
    sha256_file,
)


SCRIPT_PATH = Path(__file__).resolve()
WORKSPACE_ROOT = SCRIPT_PATH.parents[5]
UPSTREAM_MANIFEST_PATH = WORKSPACE_ROOT / SOURCE_ROSTER_PATH
PROMPT_TEMPLATE_PATH = EXPERIMENT_ROOT / "prompt-template.txt"
SOURCE_ROSTER_OUTPUT = "source-roster.json"
PRODUCTION_PLAN_OUTPUT = "production-plan.json"
TARGET_SCHEMA_VERSION = "five-head-chibi-target-v1"
ASSIGNMENT_SCHEMA_VERSION = "five-head-chibi-assignment-v1"
PLAN_SCHEMA_VERSION = "five-head-chibi-production-plan-v1"
ROSTER_SCHEMA_VERSION = "five-head-chibi-source-roster-v1"
TRANSACTION_FILE = ".materialize-plan.transaction.json"
TRANSACTION_SCHEMA_VERSION = "five-head-chibi-materialization-transaction-v1"
STAGING_PREFIX = ".materialize-plan-stage-"


@dataclass
class SelectedPair:
    hero_id: str
    display_name: str
    design_ordinal: int
    source_wave_id: str
    summon_target_id: str
    historical_chibi_target_id: str
    summon_path: str
    summon_sha256: str
    historical_chibi_path: str
    historical_chibi_sha256: str
    character_facts: dict[str, Any]


def _canonical_json(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ContractError(f"cannot load JSON at {path}: {error}") from error
    if not isinstance(value, dict):
        raise ContractError(f"JSON object required at {path}")
    return value


def _load_upstream_manifest() -> dict[str, Any]:
    if sha256_file(UPSTREAM_MANIFEST_PATH) != SOURCE_ROSTER_SHA256:
        raise ContractError("upstream manifest hash differs from frozen authority")
    return _load_json(UPSTREAM_MANIFEST_PATH)


def _source_target_path(pair: Mapping[str, Any], target_id_key: str) -> Path:
    hero_id = pair["heroId"]
    target_id = pair[target_id_key]
    prefix = f"{hero_id}-"
    if not isinstance(target_id, str) or not target_id.startswith(prefix):
        raise ContractError(f"{target_id_key} does not belong to heroId")
    version = target_id.removeprefix(prefix)
    return (
        WORKSPACE_ROOT
        / "assets/heroes/experiments/one-star-overnight-200-001/waves"
        / pair["waveId"]
        / "targets"
        / hero_id
        / f"{version}.json"
    )


def _resolve_source(pair: Mapping[str, Any], target_id_key: str, expected_kind: str, expected_hash_key: str) -> tuple[dict[str, Any], str, str]:
    target = _load_json(_source_target_path(pair, target_id_key))
    if target.get("targetId") != pair[target_id_key] or target.get("heroId") != pair["heroId"]:
        raise ContractError("source target does not match selected pair")
    if target.get("imageKind") != expected_kind:
        raise ContractError("source target has the wrong image kind")
    output = target.get("output")
    if not isinstance(output, dict) or not isinstance(output.get("candidatePath"), str):
        raise ContractError("source target lacks candidate path")
    candidate_path = WORKSPACE_ROOT / output["candidatePath"]
    if not candidate_path.is_file():
        raise ContractError(f"source {expected_kind} PNG is missing")
    recorded_hash = pair.get(expected_hash_key)
    actual_hash = sha256_file(candidate_path)
    if recorded_hash != actual_hash:
        raise ContractError(f"source {expected_kind} PNG hash differs from selected-pair record")
    return target, output["candidatePath"], actual_hash


def load_selected_pairs(*, manifest: dict[str, Any] | None = None) -> list[SelectedPair]:
    """Resolve every source image and copy only selected-pair plus summon facts."""
    if manifest is None:
        manifest = _load_upstream_manifest()
    elif hashlib.sha256(_canonical_json(manifest)).hexdigest() != SOURCE_ROSTER_SHA256:
        raise ContractError("upstream manifest hash differs from frozen authority")
    selected = manifest.get("selectedPairs")
    if not isinstance(selected, list) or len(selected) != 200:
        raise ContractError("upstream selectedPairs must contain exactly 200 records")
    pairs: list[SelectedPair] = []
    for selected_pair in selected:
        if not isinstance(selected_pair, dict):
            raise ContractError("upstream selected pair must be an object")
        required = ("heroId", "displayName", "designOrdinal", "waveId", "summonTargetId", "chibiTargetId", "summonSourceSha256", "chibiSourceSha256")
        if any(key not in selected_pair for key in required):
            raise ContractError("upstream selected pair is incomplete")
        summon_target, summon_path, summon_hash = _resolve_source(selected_pair, "summonTargetId", "summon", "summonSourceSha256")
        _, chibi_path, chibi_hash = _resolve_source(selected_pair, "chibiTargetId", "combat-chibi", "chibiSourceSha256")
        facts = summon_target.get("heroSpec")
        if not isinstance(facts, dict):
            raise ContractError("source summon target lacks immutable character facts")
        pairs.append(SelectedPair(
            hero_id=selected_pair["heroId"], display_name=selected_pair["displayName"],
            design_ordinal=selected_pair["designOrdinal"], source_wave_id=selected_pair["waveId"],
            summon_target_id=selected_pair["summonTargetId"], historical_chibi_target_id=selected_pair["chibiTargetId"],
            summon_path=summon_path, summon_sha256=summon_hash,
            historical_chibi_path=chibi_path, historical_chibi_sha256=chibi_hash,
            character_facts=copy.deepcopy(facts),
        ))
    pairs.sort(key=lambda item: (item.design_ordinal, item.hero_id))
    return pairs


def _validate_pairs(pairs: Sequence[SelectedPair]) -> None:
    if len(pairs) != 200:
        raise ContractError("source roster must contain exactly 200 records")
    if len({pair.hero_id for pair in pairs}) != len(pairs):
        raise ContractError("source roster contains duplicate heroId")
    if [(pair.design_ordinal, pair.hero_id) for pair in pairs] != sorted((pair.design_ordinal, pair.hero_id) for pair in pairs):
        raise ContractError("source roster is not sorted by designOrdinal and heroId")
    for pair in pairs:
        summon_path = WORKSPACE_ROOT / pair.summon_path
        historical_chibi_path = WORKSPACE_ROOT / pair.historical_chibi_path
        if not summon_path.is_file():
            raise ContractError("summon PNG is missing")
        if sha256_file(summon_path) != pair.summon_sha256:
            raise ContractError("summon PNG hash differs from selected-pair record")
        if not historical_chibi_path.is_file():
            raise ContractError("historical chibi PNG is missing")
        if sha256_file(historical_chibi_path) != pair.historical_chibi_sha256:
            raise ContractError("historical chibi PNG hash differs from selected-pair record")


def build_source_roster(pairs: list[SelectedPair]) -> dict[str, Any]:
    _validate_pairs(pairs)
    return {
        "schemaVersion": ROSTER_SCHEMA_VERSION,
        "experimentId": EXPERIMENT_ID,
        "upstreamManifestPath": SOURCE_ROSTER_PATH,
        "upstreamManifestSha256": SOURCE_ROSTER_SHA256,
        "records": [{
            "heroId": pair.hero_id, "displayName": pair.display_name, "designOrdinal": pair.design_ordinal,
            "sourceWaveId": pair.source_wave_id, "summonTargetId": pair.summon_target_id,
            "historicalChibiTargetId": pair.historical_chibi_target_id, "summonPath": pair.summon_path,
            "summonSha256": pair.summon_sha256, "historicalChibiPath": pair.historical_chibi_path,
            "historicalChibiSha256": pair.historical_chibi_sha256,
        } for pair in pairs],
    }


def _prompt_substitutions(facts: Mapping[str, Any]) -> dict[str, str]:
    identity = facts["identity"]
    hair = facts["hair"]
    wardrobe = facts["wardrobe"]
    physique = facts["physique"]
    details = facts["details"]
    anchors = details.get("anchors", [])
    durable = "; ".join(anchors) if anchors else "no accessory"
    durable += f"; tattoo scope: {details.get('tattooScope', 'none')}"
    return {
        PROMPT_SUBSTITUTIONS[0]: f"{identity['displayName']}, age {identity['age']}, {identity['gender']}, skin-value band {identity['skinValueBand']}; {identity['faceDescription']}",
        PROMPT_SUBSTITUTIONS[1]: f"{physique['bodyType']}, {physique['heightBand']}; {physique['description']}",
        PROMPT_SUBSTITUTIONS[2]: f"{hair['colorFamily']} {hair['silhouetteFamily']}; accent: {hair['accent']}",
        PROMPT_SUBSTITUTIONS[3]: f"{wardrobe['family']} in {wardrobe['paletteFamily']}; {wardrobe['description']}",
        PROMPT_SUBSTITUTIONS[4]: "the source-faithful visible footwear",
        PROMPT_SUBSTITUTIONS[5]: durable,
    }


def _load_frozen_prompt_template() -> str:
    if sha256_file(PROMPT_TEMPLATE_PATH) != PROMPT_TEMPLATE_SHA256:
        raise ContractError("prompt template hash differs from frozen authority")
    try:
        return PROMPT_TEMPLATE_PATH.read_text(encoding="utf-8")
    except OSError as error:
        raise ContractError(f"cannot read prompt template: {error}") from error


def _wave_for_index(index: int) -> str:
    running = 0
    for ordinal, size in enumerate(WAVE_SIZES, start=1):
        if index < running + size:
            return f"wave-{ordinal:02d}"
        running += size
    raise ContractError("target index exceeds frozen wave allocation")


def build_targets(roster: dict[str, Any]) -> list[dict[str, Any]]:
    records = roster.get("records")
    if roster.get("upstreamManifestSha256") != SOURCE_ROSTER_SHA256 or not isinstance(records, list) or len(records) != 200:
        raise ContractError("source roster is not frozen to the 200-record authority")
    pairs = load_selected_pairs()
    if [{key: record[key] for key in record} for record in records] != build_source_roster(pairs)["records"]:
        raise ContractError("source roster records differ from resolved immutable sources")
    template = _load_frozen_prompt_template()
    targets: list[dict[str, Any]] = []
    for index, pair in enumerate(pairs):
        prompt = render_prompt(template, _prompt_substitutions(pair.character_facts))
        wave_id = _wave_for_index(index)
        targets.append({
            "schemaVersion": TARGET_SCHEMA_VERSION, "experimentId": EXPERIMENT_ID,
            "targetId": f"{pair.hero_id}-five-head-combat-chibi-v1", "heroId": pair.hero_id,
            "displayName": pair.display_name, "designOrdinal": pair.design_ordinal, "waveId": wave_id,
            "promptVersion": PROMPT_VERSION, "renderedPrompt": prompt, "renderedPromptSha256": sha256_text(prompt),
            "generationReferences": [{"path": pair.summon_path, "sha256": pair.summon_sha256, "role": "sole-summon-authority"}],
            "historicalChibi": {"targetId": pair.historical_chibi_target_id, "path": pair.historical_chibi_path, "sha256": pair.historical_chibi_sha256},
            "characterFacts": copy.deepcopy(pair.character_facts),
            "output": {"width": CANVAS_WIDTH, "height": CANVAS_HEIGHT, "mimeType": CANVAS_MIME_TYPE},
            "lifecycle": LIFECYCLE,
        })
    return targets


def build_assignments(targets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if len(targets) != 200:
        raise ContractError("target set must contain exactly 200 records")
    if len({target.get("targetId") for target in targets}) != 200:
        raise ContractError("target set contains duplicate targetId")
    assignments: list[dict[str, Any]] = []
    for target in targets:
        hero_id, wave_id, target_id = target["heroId"], target["waveId"], target["targetId"]
        assignment_id = f"assignment-{target_id}"
        wave_root = f"assets/heroes/experiments/{EXPERIMENT_ID}/waves/{wave_id}"
        assignments.append({
            "schemaVersion": ASSIGNMENT_SCHEMA_VERSION, "experimentId": EXPERIMENT_ID,
            "assignmentId": assignment_id, "targetId": target_id, "heroId": hero_id, "waveId": wave_id,
            "providerSourcePath": f"{wave_root}/provider-sources/{hero_id}.png",
            "candidatePath": f"{wave_root}/candidates/{hero_id}.png",
            "resultPath": f"{wave_root}/results/{hero_id}.json",
            "exclusiveOwner": assignment_id, "status": "planned",
        })
    return assignments


def build_production_plan(roster: dict[str, Any], targets: list[dict[str, Any]], assignments: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "schemaVersion": PLAN_SCHEMA_VERSION, "experimentId": EXPERIMENT_ID,
        "sourceRosterPath": f"assets/heroes/experiments/{EXPERIMENT_ID}/{SOURCE_ROSTER_OUTPUT}",
        "sourceRosterSha256": hashlib.sha256(_canonical_json(roster)).hexdigest(),
        "targets": targets, "assignments": assignments,
        "waveSizes": list(WAVE_SIZES),
    }


def validate_plan(plan: Mapping[str, Any]) -> None:
    targets, assignments = plan.get("targets"), plan.get("assignments")
    if plan.get("experimentId") != EXPERIMENT_ID or not isinstance(targets, list) or not isinstance(assignments, list):
        raise ContractError("production plan has an invalid shape")
    if len(targets) != 200 or len(assignments) != 200:
        raise ContractError("production plan must contain exactly 200 targets and assignments")
    if len({target.get("targetId") for target in targets}) != 200:
        raise ContractError("production plan contains duplicate targetId")
    sort_keys = [(target.get("designOrdinal"), target.get("heroId")) for target in targets]
    if sort_keys != sorted(sort_keys):
        raise ContractError("production plan targets are not in deterministic sort order")
    if [assignment.get("targetId") for assignment in assignments] != [target.get("targetId") for target in targets]:
        raise ContractError("production plan assignments are not in target sort order")
    wave_counts = [sum(assignment.get("waveId") == f"wave-{wave:02d}" for assignment in assignments) for wave in range(1, 14)]
    if wave_counts != list(WAVE_SIZES):
        raise ContractError("production plan wave sizes differ from frozen allocation")
    paths = [path for assignment in assignments for path in (assignment.get("providerSourcePath"), assignment.get("candidatePath"), assignment.get("resultPath"))]
    if any(not isinstance(path, str) for path in paths) or len(paths) != len(set(paths)):
        raise ContractError("production plan output paths are not exclusive")
    for target, assignment in zip(targets, assignments):
        references = target.get("generationReferences")
        if not isinstance(references, list) or len(references) != 1 or "combat-chibi" in references[0].get("path", ""):
            raise ContractError("target generation references must contain only its summon")
        if "[" in target.get("renderedPrompt", "") or "]" in target.get("renderedPrompt", ""):
            raise ContractError("target prompt contains unresolved brackets")
        if target.get("renderedPromptSha256") != sha256_text(target["renderedPrompt"]):
            raise ContractError("target rendered prompt hash is stale")
        if assignment.get("exclusiveOwner") != assignment.get("assignmentId"):
            raise ContractError("assignment exclusive owner must be its assignmentId")


def _expected_files(roster: dict[str, Any], targets: list[dict[str, Any]], assignments: list[dict[str, Any]]) -> list[tuple[str, bytes]]:
    plan = build_production_plan(roster, targets, assignments)
    files = [(SOURCE_ROSTER_OUTPUT, _canonical_json(roster)), (PRODUCTION_PLAN_OUTPUT, _canonical_json(plan))]
    for target, assignment in zip(targets, assignments):
        files.append((f"waves/{target['waveId']}/targets/{target['heroId']}.json", _canonical_json(target)))
        files.append((f"waves/{assignment['waveId']}/assignments/{assignment['heroId']}.json", _canonical_json(assignment)))
    return files


def _transaction_path(root: Path) -> Path:
    return root / TRANSACTION_FILE


def _expected_files_sha256(expected: Sequence[tuple[str, bytes]]) -> str:
    return hashlib.sha256(_canonical_json([
        {"path": relative, "sha256": hashlib.sha256(payload).hexdigest()}
        for relative, payload in expected
    ])).hexdigest()


def _atomic_replace(path: Path, payload: bytes) -> None:
    """Publish one metadata file without making a partial byte sequence visible."""
    temporary = path.parent / f".{path.name}.{uuid.uuid4().hex}.tmp"
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    except OSError as error:
        try:
            temporary.unlink(missing_ok=True)
        except OSError:
            pass
        raise ContractError(f"cannot atomically publish transaction metadata: {error}") from error


def _start_or_verify_transaction(root: Path, expected: Sequence[tuple[str, bytes]]) -> bool:
    """Return whether an interrupted transaction is being resumed."""
    path = _transaction_path(root)
    expected_sha256 = _expected_files_sha256(expected)
    if path.exists() or path.is_symlink():
        if path.is_symlink() or not path.is_file():
            raise ContractError("materialization transaction marker is not a regular file")
        marker = _load_json(path)
        if (
            marker.get("schemaVersion") != TRANSACTION_SCHEMA_VERSION
            or marker.get("expectedFilesSha256") != expected_sha256
        ):
            raise ContractError("incomplete materialization transaction does not match this queue")
        return True
    _atomic_replace(path, _canonical_json({
        "schemaVersion": TRANSACTION_SCHEMA_VERSION,
        "expectedFilesSha256": expected_sha256,
    }))
    return False


def _remove_transaction(root: Path) -> None:
    path = _transaction_path(root)
    try:
        path.unlink(missing_ok=True)
    except OSError as error:
        raise ContractError(f"cannot clear completed materialization transaction: {error}") from error


def _stage_missing_files(root: Path, missing: Sequence[tuple[str, bytes]]) -> Path:
    staging = Path(tempfile.mkdtemp(prefix=STAGING_PREFIX, dir=root))
    try:
        for relative, payload in missing:
            exclusive_write(staging / relative, payload)
        return staging
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        raise


def _rollback_published(created: Sequence[tuple[Path, int, int]]) -> None:
    """Unlink only exact inodes linked by this transaction; never remove a replacement."""
    for path, device, inode in reversed(created):
        try:
            current = os.stat(path, follow_symlinks=False)
            if (current.st_dev, current.st_ino) == (device, inode):
                path.unlink()
        except OSError:
            continue


def _publish_staged_files(root: Path, staging: Path, missing: Sequence[tuple[str, bytes]], outcome: dict[str, int], created: list[tuple[Path, int, int]]) -> None:
    for relative, payload in missing:
        staged = staging / relative
        final = root / relative
        final.parent.mkdir(parents=True, exist_ok=True)
        try:
            os.link(staged, final, follow_symlinks=False)
        except FileExistsError:
            if final.is_symlink() or not final.is_file() or final.read_bytes() != payload:
                raise ContractError(f"publication collision at {final}")
            outcome["alreadyIdentical"] += 1
        except OSError as error:
            raise ContractError(f"cannot publish staged queue file {final}: {error}") from error
        else:
            inode = os.stat(final, follow_symlinks=False)
            created.append((final, inode.st_dev, inode.st_ino))
            outcome["created"] += 1


def materialize(root: Path, roster: dict[str, Any], targets: list[dict[str, Any]], assignments: list[dict[str, Any]]) -> dict[str, int]:
    plan = build_production_plan(roster, targets, assignments)
    validate_plan(plan)
    expected = _expected_files(roster, targets, assignments)
    root = root.resolve(strict=True)
    missing: list[tuple[str, bytes]] = []
    outcome = {"created": 0, "alreadyIdentical": 0}
    for relative, payload in expected:
        path = root / relative
        if path.exists() or path.is_symlink():
            if path.is_symlink() or not path.is_file() or path.read_bytes() != payload:
                raise ContractError(f"occupied path has different bytes: {path}")
            outcome["alreadyIdentical"] += 1
        else:
            missing.append((relative, payload))
    resuming = _start_or_verify_transaction(root, expected)
    if not missing:
        _remove_transaction(root)
        return outcome
    staging = _stage_missing_files(root, missing)
    created: list[tuple[Path, int, int]] = []
    try:
        _publish_staged_files(root, staging, missing, outcome, created)
    except Exception:
        _rollback_published(created)
        if not resuming:
            _remove_transaction(root)
        raise
    finally:
        shutil.rmtree(staging, ignore_errors=True)
    _remove_transaction(root)
    return outcome


def check(root: Path, roster: dict[str, Any], targets: list[dict[str, Any]], assignments: list[dict[str, Any]]) -> dict[str, int]:
    transaction = _transaction_path(root)
    if transaction.exists() or transaction.is_symlink():
        raise ContractError("incomplete materialization transaction is present; rerun --write to recover")
    validate_plan(build_production_plan(roster, targets, assignments))
    expected = _expected_files(roster, targets, assignments)
    missing = 0
    for relative, payload in expected:
        path = root / relative
        if not path.is_file() or path.read_bytes() != payload:
            missing += 1
    if missing:
        raise ContractError(f"materialized queue differs from immutable plan in {missing} file(s)")
    return {"heroes": len(roster["records"]), "targets": len(targets), "assignments": len(assignments), "waves": len(WAVE_SIZES), "sourceDrift": 0}


def main() -> int:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true")
    mode.add_argument("--check", action="store_true")
    args = parser.parse_args()
    pairs = load_selected_pairs()
    roster = build_source_roster(pairs)
    targets = build_targets(roster)
    assignments = build_assignments(targets)
    root = WORKSPACE_ROOT / EXPERIMENT_ROOT
    outcome = materialize(root, roster, targets, assignments) if args.write else check(root, roster, targets, assignments)
    print(json.dumps(outcome, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
