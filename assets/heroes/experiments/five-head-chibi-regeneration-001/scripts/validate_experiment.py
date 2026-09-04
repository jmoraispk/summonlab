#!/usr/bin/env python3
"""Validate the complete candidate-only five-head chibi regeneration run."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path
from typing import Any

from contracts import (
    CANVAS_HEIGHT,
    CANVAS_MIME_TYPE,
    CANVAS_WIDTH,
    ContractError,
    EXPERIMENT_ID,
    EXPERIMENT_ROOT,
    LIFECYCLE,
    PRIMARY_CALL_LIMIT,
    PRODUCTION_BASE_COMMIT,
    PROMPT_TEMPLATE_SHA256,
    PROMPT_VERSION,
    RETRY_CALL_LIMIT,
    SOURCE_ROSTER_PATH,
    SOURCE_ROSTER_SHA256,
    UPSTREAM_COMPLETION_REPORT_SHA256,
    WAVE_SIZES,
    exclusive_write,
    sha256_file,
)
from materialize_plan import (
    build_assignments,
    build_source_roster,
    build_targets,
    check as check_materialized_plan,
    load_selected_pairs,
)
from validate_wave import _load_journal, validate_wave


SCRIPT_PATH = Path(__file__).resolve()
DEFAULT_ROOT = SCRIPT_PATH.parent.parent
COMPLETION_SCHEMA = "five-head-chibi-completion-report-v1"
UPSTREAM_COMPLETION_REPORT_PATH = (
    "assets/heroes/experiments/one-star-overnight-200-001/completion-report.json"
)
AUTHORIZED_COMMITTED_PREFIX = f"{EXPERIMENT_ROOT.as_posix()}/"
AUTHORIZED_COMMITTED_FILES = frozenset({"docs/wiki/art/hero-identity-and-evolution.md"})
PROMOTION_KEYS = frozenset({
    "approved", "approval", "approvalstatus", "runtimebinding", "runtimebindings",
    "promoted", "promotionstatus",
})


def _load_object(path: Path, label: str) -> dict[str, Any]:
    if path.is_symlink() or not path.is_file():
        raise ContractError(f"{label} must be a regular file: {path}")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ContractError(f"cannot read {label}: {error}") from error
    if not isinstance(value, dict):
        raise ContractError(f"{label} must be a JSON object")
    return value


def _workspace(root: Path) -> Path:
    resolved = root.resolve(strict=True)
    expected_tail = ("assets", "heroes", "experiments", EXPERIMENT_ID)
    if tuple(resolved.parts[-4:]) != expected_tail:
        raise ContractError("completion root is not the five-head experiment root")
    return resolved.parents[3]


def validate_committed_scope(paths: list[str]) -> None:
    """Reject committed changes outside this experiment and its one authorized wiki note."""
    if any(not isinstance(path, str) or not path for path in paths):
        raise ContractError("committed scope contains an invalid path")
    outside = [
        path for path in paths
        if not path.startswith(AUTHORIZED_COMMITTED_PREFIX) and path not in AUTHORIZED_COMMITTED_FILES
    ]
    if outside:
        raise ContractError(f"committed file is outside the candidate-only scope: {outside[0]}")


def _committed_paths(workspace: Path) -> list[str]:
    try:
        completed = subprocess.run(
            ["git", "diff", "--name-only", "--diff-filter=ACDMRTUXB", f"{PRODUCTION_BASE_COMMIT}..HEAD", "--"],
            cwd=workspace,
            check=True,
            capture_output=True,
            text=True,
        )
    except (OSError, subprocess.CalledProcessError) as error:
        raise ContractError(f"cannot verify committed candidate-only scope: {error}") from error
    paths = [line for line in completed.stdout.splitlines() if line]
    validate_committed_scope(paths)
    return paths


def _reject_promotion_claim(value: object, label: str) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if key.lower() in PROMOTION_KEYS and child not in (False, 0, None, "", [], {}):
                raise ContractError(f"{label} contains an approval, promotion, or runtime-binding claim")
            _reject_promotion_claim(child, label)
    elif isinstance(value, list):
        for child in value:
            _reject_promotion_claim(child, label)


def _validate_candidate_only_tree(root: Path) -> None:
    allowed_top_level = {
        ".gitignore", ".materialize-plan.lock", "README.md", "completion-report.json", "decision.json",
        "production-plan.json", "production-report.json", "prompt-template.txt", "provenance", "scripts",
        "source-roster.json", "tests", "waves",
    }
    for entry in root.iterdir():
        if entry.name not in allowed_top_level:
            raise ContractError(f"candidate-only experiment contains undeclared top-level path: {entry.name}")
        if any(part.lower() in {"approved", "runtime", "promoted"} for part in entry.relative_to(root).parts):
            raise ContractError("candidate-only experiment contains a promotion path")
    for path in root.rglob("*.json"):
        if path.is_symlink() or not path.is_file():
            raise ContractError("candidate-only JSON evidence must be a regular file")
        _reject_promotion_claim(_load_object(path, "candidate-only evidence"), path.relative_to(root).as_posix())


def completion_report_bytes(report: dict[str, Any]) -> bytes:
    """Return stable JSON bytes; the report intentionally contains no wall-clock timestamp."""
    validate_completion_summary(report)
    return (json.dumps(report, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def validate_completion_summary(report: dict[str, Any]) -> None:
    """Fail closed if a purported completion summary weakens any frozen invariant."""
    expected_inventory = {
        "sourceHeroes": 200,
        "targets": 200,
        "assignments": 200,
        "providerSources": 200,
        "candidates": 200,
        "results": 200,
        "waves": 13,
    }
    if report.get("schemaVersion") != COMPLETION_SCHEMA or report.get("experimentId") != EXPERIMENT_ID:
        raise ContractError("completion summary has unsupported schema or experiment")
    if report.get("status") != "complete" or report.get("inventory") != expected_inventory:
        raise ContractError("completion inventory is not exact")
    source = report.get("sourceEvidence")
    if not isinstance(source, dict) or source.get("reviewManifestSha256") != SOURCE_ROSTER_SHA256 or source.get("upstreamCompletionReportSha256") != UPSTREAM_COMPLETION_REPORT_SHA256:
        raise ContractError("completion source evidence differs from the frozen authority")
    prompt = report.get("prompt")
    if prompt != {
        "version": PROMPT_VERSION,
        "templateSha256": PROMPT_TEMPLATE_SHA256,
        "targetCount": 200,
        "soleSummonReferenceCount": 200,
    }:
        raise ContractError("completion prompt or reference evidence differs")
    outputs = report.get("outputs")
    if outputs != {
        "width": CANVAS_WIDTH,
        "height": CANVAS_HEIGHT,
        "mimeType": CANVAS_MIME_TYPE,
        "readableProviderPngs": 200,
        "byteIdenticalCandidates": 200,
    }:
        raise ContractError("completion PNG evidence differs")
    calls = report.get("calls")
    if not isinstance(calls, dict):
        raise ContractError("completion call evidence is missing")
    primary, retries = calls.get("primary"), calls.get("retries")
    if primary != PRIMARY_CALL_LIMIT or not isinstance(retries, int) or not 0 <= retries <= RETRY_CALL_LIMIT:
        raise ContractError("completion call budget differs")
    if calls.get("total") != primary + retries or calls.get("providerNoOutputPrimaries") != retries or calls.get("successful") != PRIMARY_CALL_LIMIT:
        raise ContractError("completion call outcomes are inconsistent")
    waves = report.get("waveValidation")
    if not isinstance(waves, list) or len(waves) != len(WAVE_SIZES):
        raise ContractError("completion wave evidence is incomplete")
    wave_retries = 0
    for index, (wave, planned) in enumerate(zip(waves, WAVE_SIZES), start=1):
        if not isinstance(wave, dict) or wave.get("waveId") != f"wave-{index:02d}" or wave.get("planned") != planned or wave.get("completed") != planned or wave.get("complete") is not True or wave.get("primaryCalls") != planned or not isinstance(wave.get("retryCalls"), int) or wave["retryCalls"] < 0:
            raise ContractError("completion wave sizes or state differ")
        wave_retries += wave["retryCalls"]
    if wave_retries != retries:
        raise ContractError("completion wave retry totals differ")
    if report.get("lifecycle") != LIFECYCLE or report.get("workflow") != {
        "approvals": 0,
        "runtimeBindings": 0,
        "review": False,
        "promotion": False,
        "committedFilesOutsideAuthorizedScope": 0,
    }:
        raise ContractError("completion report claims review, approval, promotion, or runtime binding")


def validate_experiment(*, root: Path = DEFAULT_ROOT) -> dict[str, Any]:
    """Validate all immutable inputs, 200 receipts, and candidate-only lifecycle evidence."""
    root = root.resolve(strict=True)
    workspace = _workspace(root)
    decision = _load_object(root / "decision.json", "decision")
    expected_decision = {
        "schemaVersion": "five-head-chibi-regeneration-decision-v1",
        "experimentId": EXPERIMENT_ID,
        "promptVersion": PROMPT_VERSION,
        "promptTemplateSha256": PROMPT_TEMPLATE_SHA256,
        "canvas": {"width": CANVAS_WIDTH, "height": CANVAS_HEIGHT, "mimeType": CANVAS_MIME_TYPE},
        "ratioTarget": 5.0,
        "sourceRosterPath": SOURCE_ROSTER_PATH,
        "sourceRosterSha256": SOURCE_ROSTER_SHA256,
        "upstreamCompletionReportSha256": UPSTREAM_COMPLETION_REPORT_SHA256,
        "productionBaseCommit": PRODUCTION_BASE_COMMIT,
        "waveSizes": list(WAVE_SIZES),
        "primaryCallLimit": PRIMARY_CALL_LIMIT,
        "retryCallLimit": RETRY_CALL_LIMIT,
        "totalCallLimit": PRIMARY_CALL_LIMIT + RETRY_CALL_LIMIT,
        "lifecycle": LIFECYCLE,
        "workflow": {"pilot": False, "review": False, "promotion": False},
    }
    if decision != expected_decision:
        raise ContractError("decision differs from the frozen completion contract")
    if sha256_file(root / "prompt-template.txt") != PROMPT_TEMPLATE_SHA256:
        raise ContractError("prompt template hash drifted")

    review_manifest = workspace / SOURCE_ROSTER_PATH
    upstream_report = workspace / UPSTREAM_COMPLETION_REPORT_PATH
    if sha256_file(review_manifest) != SOURCE_ROSTER_SHA256:
        raise ContractError("upstream review manifest drifted")
    if sha256_file(upstream_report) != UPSTREAM_COMPLETION_REPORT_SHA256:
        raise ContractError("upstream completion report drifted")
    committed_paths = _committed_paths(workspace)
    _validate_candidate_only_tree(root)

    pairs = load_selected_pairs()
    roster = build_source_roster(pairs)
    targets = build_targets(roster)
    assignments = build_assignments(targets)
    plan_check = check_materialized_plan(root, roster, targets, assignments)
    if plan_check != {"heroes": 200, "targets": 200, "assignments": 200, "waves": 13, "sourceDrift": 0}:
        raise ContractError("materialized queue completion counts differ")

    roster_path = root / "source-roster.json"
    plan_path = root / "production-plan.json"
    materialized_roster = _load_object(roster_path, "source roster")
    materialized_plan = _load_object(plan_path, "production plan")
    target_records, assignment_records = materialized_plan.get("targets"), materialized_plan.get("assignments")
    if materialized_roster != roster or target_records != targets or assignment_records != assignments:
        raise ContractError("materialized roster, targets, or assignments drifted")

    roster_by_hero = {record["heroId"]: record for record in materialized_roster["records"]}
    sole_references = 0
    for target in target_records:
        if target.get("promptVersion") != PROMPT_VERSION or target.get("lifecycle") != LIFECYCLE:
            raise ContractError("target prompt version or lifecycle differs")
        prompt = target.get("renderedPrompt")
        if not isinstance(prompt, str) or hashlib.sha256(prompt.encode("utf-8")).hexdigest() != target.get("renderedPromptSha256"):
            raise ContractError("target rendered prompt hash differs")
        references = target.get("generationReferences")
        if not isinstance(references, list) or len(references) != 1:
            raise ContractError("target does not have exactly one generation reference")
        reference = references[0]
        source = roster_by_hero.get(target.get("heroId"))
        if source is None or reference != {
            "path": source["summonPath"], "role": "sole-summon-authority", "sha256": source["summonSha256"]
        }:
            raise ContractError("target reference is not its frozen summon authority")
        sole_references += 1

    wave_results = [validate_wave(f"wave-{index:02d}", root=root) for index in range(1, len(WAVE_SIZES) + 1)]
    if not all(result.complete for result in wave_results):
        raise ContractError("one or more production waves are incomplete")
    journal = _load_journal(root)
    primary = sum(record.get("callKind") == "primary" for record in journal)
    retries = sum(record.get("callKind") == "provider-no-output-retry" for record in journal)
    no_output = sum(record.get("callKind") == "primary" and record.get("outcome") == "provider-no-output" for record in journal)
    successful = sum(record.get("outcome") == "succeeded" for record in journal)

    report = {
        "schemaVersion": COMPLETION_SCHEMA,
        "experimentId": EXPERIMENT_ID,
        "status": "complete",
        "lifecycle": LIFECYCLE,
        "sourceEvidence": {
            "reviewManifestPath": SOURCE_ROSTER_PATH,
            "reviewManifestSha256": SOURCE_ROSTER_SHA256,
            "upstreamCompletionReportPath": UPSTREAM_COMPLETION_REPORT_PATH,
            "upstreamCompletionReportSha256": UPSTREAM_COMPLETION_REPORT_SHA256,
            "productionBaseCommit": PRODUCTION_BASE_COMMIT,
            "committedFileCount": len(committed_paths),
            "sourceRosterSha256": sha256_file(roster_path),
            "productionPlanSha256": sha256_file(plan_path),
            "productionJournalSha256": sha256_file(root / "provenance/production-journal.jsonl"),
        },
        "inventory": {
            "sourceHeroes": len(materialized_roster["records"]),
            "targets": len(list((root / "waves").glob("wave-*/targets/*.json"))),
            "assignments": len(list((root / "waves").glob("wave-*/assignments/*.json"))),
            "providerSources": len(list((root / "waves").glob("wave-*/provider-sources/*.png"))),
            "candidates": len(list((root / "waves").glob("wave-*/candidates/*.png"))),
            "results": len(list((root / "waves").glob("wave-*/results/*.json"))),
            "waves": len([path for path in (root / "waves").glob("wave-*") if path.is_dir() and not path.is_symlink()]),
        },
        "prompt": {
            "version": PROMPT_VERSION,
            "templateSha256": PROMPT_TEMPLATE_SHA256,
            "targetCount": len(target_records),
            "soleSummonReferenceCount": sole_references,
        },
        "outputs": {
            "width": CANVAS_WIDTH,
            "height": CANVAS_HEIGHT,
            "mimeType": CANVAS_MIME_TYPE,
            "readableProviderPngs": sum(result.completed for result in wave_results),
            "byteIdenticalCandidates": sum(result.completed for result in wave_results),
        },
        "calls": {
            "primary": primary,
            "retries": retries,
            "total": len(journal),
            "providerNoOutputPrimaries": no_output,
            "successful": successful,
        },
        "waveValidation": [
            {
                "waveId": result.wave_id,
                "planned": result.planned,
                "completed": result.completed,
                "complete": result.complete,
                "primaryCalls": result.primary_calls,
                "retryCalls": result.retry_calls,
            }
            for result in wave_results
        ],
        "workflow": {
            "approvals": 0,
            "runtimeBindings": 0,
            "review": False,
            "promotion": False,
            "committedFilesOutsideAuthorizedScope": 0,
        },
    }
    validate_completion_summary(report)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="validate without writing completion-report.json")
    args = parser.parse_args()
    report = validate_experiment()
    payload = completion_report_bytes(report)
    if not args.check:
        exclusive_write(DEFAULT_ROOT / "completion-report.json", payload)
    print(payload.decode("utf-8"), end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
