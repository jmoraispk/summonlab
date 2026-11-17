"""Run a planned batch (rigging/batches/<name>.json) on the Tripo API.

  TRIPO_CONCURRENCY=6 python rigging/scripts/batch_run.py rigging/batches/starting-set.json --budget 7000 [--only hero,monster,equipment]

Per subject, by body plan:
  creatures: neutral-pose image (t_pose template for bipeds) -> image-to-model (Smart Mesh, PBR, 10k faces)
             -> free rig-check (stop if not riggable) -> rig (rig type from the body plan) -> preset clips
  equipment: image-to-model (Smart Mesh, PBR, 2k faces)
Every task goes to rigging/ledger.jsonl; finished steps are reused on re-runs. A per-subject status table is
written to rigging/results/batch-<name>.json at the end.
"""
from __future__ import annotations

import json
import sys
import time
import traceback
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image

import tripo
from batch_sample import BIPED_DONOR, RIG_BIPED, RIG_OTHER, check_output, image, log, rig_check, token, to_model

EXP = Path(__file__).resolve().parents[2]
REPO = EXP.parents[1]
WORK = EXP / "work" / "sample"
PRESETS = {
    "biped": BIPED_DONOR,
    "quadruped": [["preset:quadruped:walk"]],
    "hexapod": [["preset:hexapod:walk"]],
    "octopod": [["preset:octopod:walk"]],
    "serpentine": [["preset:serpentine:march"]],
    "aquatic": [["preset:aquatic:march"]],
    "avian": [],
    "others": [],
}


def prepared(sid: str, src: str) -> Path:
    WORK.mkdir(parents=True, exist_ok=True)
    out = WORK / f"{sid}__source.png"
    if not out.exists():
        im = Image.open(REPO / src).convert("RGB")
        im.thumbnail((2048, 2048))
        im.save(out)
    return out


def rig(step: str, model_task: str, body: str, budget: tripo.Budget) -> dict:
    payload = {"input": model_task, "rig_type": body, "out_format": "glb"}
    if body == "biped":
        payload.update(model=RIG_BIPED, spec="mixamo")
    elif body == "others":
        payload.update(model=RIG_BIPED)  # "others" exists only on v3.0
    else:
        payload.update(model=RIG_OTHER)
    return tripo.run(step, "/animations/rig", payload, budget, estimate=25)


def creature(s: dict, budget: tripo.Budget) -> dict:
    sid, body = s["id"], s["body"]
    status = {"id": sid, "kind": s["kind"], "body": body}
    img = image(f"{sid}-neutral--image", prepared(sid, s["source"]), s["prompt"], budget,
                template="t_pose" if body == "biped" else None)
    status["image"] = "ok"
    model = to_model(f"{sid}-neutral--model", img["task_id"], budget, 10000)
    status["model"] = "ok"
    chk = check_output(rig_check(f"{sid}-neutral--rig-check", model["task_id"]))
    status["rigCheck"] = chk
    if chk.get("riggable") is False and not FORCE_RIG:
        status["rig"] = "not riggable"
        log(f"{sid}: rig-check says NOT riggable; stopping this chain")
        return status
    if chk.get("riggable") is False:
        log(f"{sid}: rig-check says NOT riggable; rigging anyway (--retry: a failed rig is not charged, the bench judges)")
        status["rigCheckOverridden"] = True
    r = rig(f"{sid}-neutral--rig-{body}", model["task_id"], body, budget)
    status["rig"] = "ok"
    clips = []
    for i, group in enumerate(PRESETS.get(body, [])):
        tripo.run(f"{sid}-neutral--anim-{i}", "/animations/retarget",
                  {"input": r["task_id"], "animations": group, "animate_in_place": True, "export_with_geometry": True},
                  budget, estimate=10 * len(group))
        clips += group
    status["clips"] = clips
    return status


def equipment(s: dict, budget: tripo.Budget) -> dict:
    to_model(f"{s['id']}--model", token(prepared(s["id"], s["source"])), budget, 2000)
    return {"id": s["id"], "kind": "equipment", "model": "ok"}


FORCE_RIG = False


def main() -> None:
    global FORCE_RIG
    batch = json.loads(Path(sys.argv[1]).read_text())
    # --retry: only subjects that failed or were not riggable in the last run; rig even if rig-check says no.
    retry = "--retry" in sys.argv
    FORCE_RIG = retry
    approved = float(sys.argv[sys.argv.index("--budget") + 1])
    only = set(sys.argv[sys.argv.index("--only") + 1].split(",")) if "--only" in sys.argv else None
    todo = [s for s in batch["subjects"] if not s.get("done") and (not only or s["kind"] in only)]
    if retry:
        last = json.loads((EXP / "rigging" / "results" / f"batch-{batch['name']}.json").read_text())["subjects"]
        todo = [s for s in todo if "error" in last.get(s["id"], {}) or last.get(s["id"], {}).get("rig") == "not riggable"]
    # Creatures first: their image step is serial on the API, so start it early.
    todo.sort(key=lambda s: s["kind"] == "equipment")
    budget = tripo.Budget(approved)
    log(f"balance before: {tripo.balance()}  subjects: {len(todo)}")

    def guarded(s: dict) -> dict:
        try:
            return (equipment if s["kind"] == "equipment" else creature)(s, budget)
        except Exception as e:  # noqa: BLE001 - one failed subject must not stop the batch
            log(f"FAILED {s['id']}: {e}")
            traceback.print_exc()
            return {"id": s["id"], "kind": s["kind"], "error": str(e)[:400]}

    t0 = time.time()
    # One thread per subject: threads only wait on the API queues, and equipment models can start while
    # creature images wait their turn (with 12 threads, equipment waited 30 minutes behind the creatures).
    with ThreadPoolExecutor(max_workers=max(12, len(todo))) as pool:
        results = list(pool.map(guarded, todo))
    out = EXP / "rigging" / "results" / f"batch-{batch['name']}.json"
    prior = json.loads(out.read_text()) if out.exists() else {"subjects": {}}
    for r in results:
        prior["subjects"][r["id"]] = r
    prior.update(name=batch["name"], lastRun=time.strftime("%Y-%m-%dT%H:%M:%S"), lastRunMinutes=round((time.time() - t0) / 60, 1))
    out.write_text(json.dumps(prior, indent=1) + "\n")
    failed = [r["id"] for r in results if "error" in r or r.get("rig") == "not riggable"]
    log(f"batch used {budget.used:g} of {approved:g} approved credits in {prior['lastRunMinutes']} min; "
        f"failed or not riggable: {failed}; balance after: {tripo.balance()}")


if __name__ == "__main__":
    main()
