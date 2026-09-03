#!/usr/bin/env python3
"""Validate a complete twenty-pair Heroes production wave."""

from __future__ import annotations

import argparse
import json
import stat
from collections import defaultdict
from pathlib import Path
from typing import Any

from contracts import (
    ContractError,
    EXPERIMENT_ROOT,
    anchored_read,
    assignment_path_for,
    ensure_no_symlink_path,
    result_path_for,
    sha256_bytes,
    sha256_json,
    validate_assignment,
    validate_result,
    validate_target,
)


def _regular_bytes(workspace: Path, relative_path: str, *, prefix: str = EXPERIMENT_ROOT) -> bytes:
    absolute = ensure_no_symlink_path(
        workspace, relative_path, allow_missing_leaf=False, prefix=prefix
    )
    if not stat.S_ISREG(absolute.lstat().st_mode):
        raise ContractError(f"expected regular file: {relative_path}")
    return anchored_read(workspace, relative_path, prefix=prefix)


def verify_execution(workspace: Path, target_relative: str) -> dict[str, Any]:
    target = validate_target(
        json.loads(_regular_bytes(workspace, target_relative)), expected_path=target_relative
    )
    assignment_relative = assignment_path_for(
        target["waveId"], target["heroId"], target["imageKind"], target["targetVersion"]
    )
    assignment = validate_assignment(
        json.loads(_regular_bytes(workspace, assignment_relative)),
        target,
        expected_path=assignment_relative,
    )
    result_relative = result_path_for(
        target["waveId"], target["heroId"], target["imageKind"], target["targetVersion"]
    )
    result_payload = _regular_bytes(workspace, result_relative)
    result = validate_result(json.loads(result_payload), target, assignment)
    if result["candidate"] is not None:
        candidate = _regular_bytes(workspace, target["output"]["candidatePath"])
        record = result["candidate"]
        if len(candidate) != record["bytes"] or sha256_bytes(candidate) != record["sha256"]:
            raise ContractError(f"candidate bytes drifted: {record['path']}")
    for reference in target["references"]:
        payload = _regular_bytes(workspace, reference["path"], prefix="assets")
        if sha256_bytes(payload) != reference["sha256"]:
            raise ContractError(f"reference bytes drifted: {reference['path']}")
    return {"target": target, "assignment": assignment, "result": result}


def _effective_wave_hero_ids(workspace: Path, wave_id: str) -> set[str] | None:
    """Resolve the append-only selected roster when the frozen production roster exists."""

    roster_path = workspace / EXPERIMENT_ROOT / "roster-plan.json"
    if not roster_path.is_file() or roster_path.is_symlink():
        return None
    from activate_reserve import _current_selection

    roster = json.loads(_regular_bytes(workspace, f"{EXPERIMENT_ROOT}/roster-plan.json"))
    selection, _used, _slots, _previous, _count = _current_selection(workspace, roster)
    selected_by_slot = {
        entry["slotHeroId"]: entry["selectedHeroId"] for entry in selection
    }
    return {
        selected_by_slot[packet["heroId"]]
        for packet in roster["active"]
        if packet["waveId"] == wave_id
    }


def validate_wave(workspace: Path, wave_id: str, *, expected_pairs: int = 20) -> dict[str, Any]:
    workspace = workspace.resolve(strict=True)
    targets_root = workspace / EXPERIMENT_ROOT / "waves" / wave_id / "targets"
    target_paths = sorted(targets_root.glob("*/*.json")) if targets_root.is_dir() else []
    executions: list[dict[str, Any]] = []
    for path in target_paths:
        relative = path.relative_to(workspace).as_posix()
        target = validate_target(
            json.loads(_regular_bytes(workspace, relative)), expected_path=relative
        )
        result_path = workspace / target["output"]["resultPath"]
        if result_path.is_file() and not result_path.is_symlink():
            executions.append(verify_execution(workspace, relative))

    by_hero_kind: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for execution in executions:
        if execution["result"]["status"] == "candidate":
            target = execution["target"]
            by_hero_kind[(target["heroId"], target["imageKind"])].append(execution)
    selected: dict[tuple[str, str], dict[str, Any]] = {}
    for key, candidates in by_hero_kind.items():
        selected[key] = max(candidates, key=lambda entry: entry["target"]["targetVersion"])

    hero_ids = {hero_id for hero_id, _kind in selected}
    effective_ids = _effective_wave_hero_ids(workspace, wave_id)
    if effective_ids is not None:
        hero_ids &= effective_ids
    hero_ids = sorted(hero_ids)
    complete: list[dict[str, Any]] = []
    for hero_id in hero_ids:
        summon = selected.get((hero_id, "summon"))
        chibi = selected.get((hero_id, "combat-chibi"))
        if summon is None or chibi is None:
            continue
        summon_target = summon["target"]
        chibi_target = chibi["target"]
        if sha256_json(summon_target["heroSpec"]) != sha256_json(chibi_target["heroSpec"]):
            raise ContractError(f"summon/chibi heroSpec drift: {hero_id}")
        source = chibi_target["sourceSummon"]
        summon_candidate = summon["result"]["candidate"]
        if (
            source["targetId"] != summon_target["targetId"]
            or source["candidatePath"] != summon_candidate["path"]
            or source["sha256"] != summon_candidate["sha256"]
            or source["resultPath"] != summon_target["output"]["resultPath"]
        ):
            raise ContractError(f"chibi does not bind the selected summon: {hero_id}")
        complete.append(
            {
                "heroId": hero_id,
                "heroSpec": summon_target["heroSpec"],
                "summon": summon,
                "combatChibi": chibi,
            }
        )
    if len(complete) != expected_pairs:
        raise ContractError(
            f"{wave_id} requires {expected_pairs} complete candidate pairs, found {len(complete)}"
        )
    if len({entry["heroId"] for entry in complete}) != len(complete):
        raise ContractError(f"{wave_id} contains duplicate completed hero IDs")
    return {
        "waveId": wave_id,
        "completePairCount": len(complete),
        "completed": complete,
        "executionCount": len(executions),
        "executions": executions,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("workspace", type=Path)
    parser.add_argument("wave_id")
    parser.add_argument("--expected-pairs", type=int, default=20)
    args = parser.parse_args()
    report = validate_wave(args.workspace, args.wave_id, expected_pairs=args.expected_pairs)
    print(
        json.dumps(
            {
                "waveId": report["waveId"],
                "completePairCount": report["completePairCount"],
                "executionCount": report["executionCount"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
