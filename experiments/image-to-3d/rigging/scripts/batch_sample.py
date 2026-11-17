"""Experiment 2b: production-pipeline sample on the Tripo API (approved 2026-11-17, cap 900 credits).

  python rigging/scripts/batch_sample.py --budget 900 [chain ...]

Each chain runs in its own thread: optional neutral-pose image -> image-to-model (Smart Mesh, PBR) ->
free rig-check -> rig (type from rig-check) -> optional preset animations. Equipment chains stop after
the model (individual pieces) or add rig + segment (armor set on a mannequin). Every task is recorded in
rigging/ledger.jsonl with its credits and seconds; outputs land in work/hosted/tripo/<step>/.
"""
from __future__ import annotations

import json
import sys
import time
import traceback
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests
from PIL import Image

import tripo

EXP = Path(__file__).resolve().parents[2]
REPO = EXP.parents[1]
WORK = EXP / "work" / "sample"
MODEL = "v3.1-20260211"
RIG_BIPED = "v3.0-20260909"
RIG_OTHER = "v2.5-20260210"

FAUNA = REPO / "assets/enemies/approved/fauna-family-v1/sources"
IRON = REPO / "assets/equipment/approved/material-equipment-v1/items/e/iron"
SOURCES = {
    "asha": REPO / "assets/heroes/visuals/realtime-combat-study-v1/saffron-braid-source-v1.png",
    "wolf": FAUNA / "wolves/wolf-gray-wolf/normal.png",
    "hawk": FAUNA / "raptors/raptor-hunting-hawk/normal.png",
    "sword": IRON / "sword.png",
    "shield": IRON / "shield.png",
    "helmet": IRON / "heavy-armor-head.png",
    "golem": REPO / "assets/enemies/experiments/family-affinity-v1/candidates/golems/golem-clay-figure/normal-v1.png",
    "wenyn": REPO / "assets/heroes/approved/summonable-roster-v1/sources/wenyn-amarun/summon.png",
    "kelan": REPO / "assets/heroes/approved/summonable-roster-v1/sources/kelan-grelan/summon.png",
}
T_POSE = ("Redraw {who} standing in a T-pose facing the camera straight on: arms straight out to the sides at "
          "shoulder height, palms down, fingers together, legs straight and slightly apart, feet flat. {pron} holds "
          "nothing. ")

STYLE_TAIL = ("Full body from head to toe, nothing cropped, centered, plain light gray background, soft even studio "
              "lighting, no ground shadow, no scenery, no text, same painterly-realistic style and colors.")
PROMPTS = {
    "asha": ("The exact same adult woman as the reference: same face, dark skin tone, shaved right temple with its "
             "geometric marking, long heavy braid hanging on her left side, hoop earring, saffron hooded wrap robe "
             "with cream trim, woven sash, dark inner layer, long cream sleeves, wrist wraps, loose cream trousers "
             "and tan boots. Redraw her standing in a T-pose facing the camera straight on: arms straight out to "
             "the sides at shoulder height, palms down, fingers together, legs straight and slightly apart, feet "
             "flat. She holds nothing. " + STYLE_TAIL),
    "wolf": ("The exact same gray wolf as the reference: same fur colors and markings, eyes, ears and body "
             "proportions. Redraw it standing calmly in a neutral pose, seen from a three-quarter side angle, "
             "head level and looking forward, mouth closed, all four legs straight and clearly separated, paws "
             "flat on the ground, tail hanging relaxed. " + STYLE_TAIL),
    "hawk": ("The exact same hawk as the reference: same feather colors, barring and markings, beak, eyes and "
             "talons. Redraw it standing upright on the ground facing the camera straight on, with both wings fully "
             "spread out horizontally to the sides like a T-pose, flight feathers fanned, tail fanned downward, legs "
             "straight with talons flat on the ground. " + STYLE_TAIL),
    "golem": ("The exact same clay golem as the reference: same rough brown clay surface, cracks, carved rune on the "
              "chest, heavy blocky limbs, small head nub, thick fingers and toes, same proportions. "
              + T_POSE.format(who="it", pron="It") + STYLE_TAIL),
    "wenyn": ("The exact same adult man as the reference: same face, short cropped dark hair, very muscular build "
              "and bare muscular arms, sleeveless teal tunic to the knees with a brown knotted sash, dark trousers "
              "wrapped at the shins, and brown shoes. " + T_POSE.format(who="him", pron="He") + STYLE_TAIL),
    "kelan": ("The exact same adult woman as the reference: same face, deep skin tone, large voluminous curly black "
              "hair, short and broad sturdy build, rust-red hooded capelet over a black long-sleeved tunic, red sash "
              "with a small pouch, rust-red wrap skirt over loose black trousers, and red boots. "
              + T_POSE.format(who="her", pron="She") + STYLE_TAIL),
    "armor": ("Assemble these four iron armor pieces into one complete suit worn by a plain smooth gray featureless "
              "mannequin standing in an A-pose facing the camera straight on: the helmet on its head, the cuirass "
              "with pauldrons on its chest and shoulders, the plated leg armor on its legs, and the boots on its "
              "feet. Arms straight and angled about 30 degrees away from the body, open empty hands. Keep the exact "
              "iron material, rivets, straps and wear of the reference pieces; do not add any other armor. "
              + STYLE_TAIL),
}


def log(msg: str) -> None:
    print(time.strftime("%H:%M:%S"), msg, flush=True)


def prepared(name: str) -> Path:
    """Upload-ready copy: PNG, longest side <= 2048."""
    WORK.mkdir(parents=True, exist_ok=True)
    out = WORK / f"{name}__source.png"
    if not out.exists():
        im = Image.open(SOURCES[name]).convert("RGB")
        im.thumbnail((2048, 2048))
        im.save(out)
    return out


def armor_sheet() -> Path:
    """The four E-rank iron heavy-armor pieces in a 2x2 sheet (helmet, cuirass / legs, boots)."""
    out = WORK / "armor__pieces.png"
    if not out.exists():
        WORK.mkdir(parents=True, exist_ok=True)
        tiles = [Image.open(IRON / f"heavy-armor-{p}.png").convert("RGB").resize((768, 768)) for p in
                 ("head", "torso", "legs", "boots")]
        sheet = Image.new("RGB", (1536, 1536))
        for i, t in enumerate(tiles):
            sheet.paste(t, ((i % 2) * 768, (i // 2) * 768))
        sheet.save(out)
    return out


_TOKENS: dict[str, str] = {}


def token(path: Path) -> str:
    if str(path) not in _TOKENS:
        _TOKENS[str(path)] = tripo.upload(path)
    return _TOKENS[str(path)]


def image(step: str, src: Path, prompt: str, budget: tripo.Budget, template: str | None = None) -> dict:
    payload = {"model": "seedream_v5", "input": token(src), "prompt": prompt}
    if template:
        payload["template"] = template
    return tripo.run(step, "/generation/image-to-image", payload, budget, estimate=10)


def to_model(step: str, inp: str, budget: tripo.Budget, face_limit: int) -> dict:
    payload = {"model": MODEL, "input": inp, "texture": True, "pbr": True, "texture_quality": "standard",
               "smart_low_poly": True, "face_limit": face_limit}
    return tripo.run(step, "/generation/image-to-model", payload, budget, estimate=40)


def rig_check(step: str, model_task: str) -> dict:
    """Free. Returns {riggable, rig_type}; recorded in the ledger like any task."""
    return tripo.run(step, "/animations/rig-check", {"input": model_task}, tripo.Budget(1e9), estimate=0)


def rig(step: str, model_task: str, rig_type: str, budget: tripo.Budget) -> dict:
    payload = {"input": model_task, "rig_type": rig_type, "out_format": "glb"}
    if rig_type == "biped":
        payload.update(model=RIG_BIPED, spec="mixamo")
    elif rig_type == "others":
        payload.update(model=RIG_BIPED)  # "others" exists only on v3.0 (v2.5 rejects it with error 1004)
    else:
        payload.update(model=RIG_OTHER)
    return tripo.run(step, "/animations/rig", payload, budget, estimate=25)


def animate(step: str, rig_task: str, presets: list[str], budget: tripo.Budget) -> dict:
    payload = {"input": rig_task, "animations": presets, "animate_in_place": True, "export_with_geometry": True}
    return tripo.run(step, "/animations/retarget", payload, budget, estimate=10 * len(presets))


def check_output(task_entry: dict) -> dict:
    return json.loads((EXP / "work/hosted/tripo" / task_entry["step"] / "task.json").read_text()).get("output") or {}


def creature(name: str, neutral: bool, budget: tripo.Budget, expect: str, presets: list[list[str]]) -> None:
    arm = "neutral" if neutral else "original"
    src = prepared(name)
    if neutral:
        img = image(f"{name}-{arm}--image", src, PROMPTS[name], budget, template="t_pose" if expect == "biped" else None)
        inp = img["task_id"]
    else:
        inp = token(src)
    model = to_model(f"{name}-{arm}--model", inp, budget, 10000)
    chk = check_output(rig_check(f"{name}-{arm}--rig-check", model["task_id"]))
    log(f"{name}-{arm} rig-check: {chk}")
    # rig-check answered "biped" for a sword, so its rig_type is only a hint: the body type comes from the
    # catalog family, and a disagreement is logged for the report.
    if chk.get("rig_type") != expect:
        log(f"{name}-{arm}: rig-check suggests {chk.get('rig_type')}, catalog says {expect}; rigging as {expect}")
    if chk.get("riggable") is False:
        log(f"{name}-{arm}: rig-check says NOT riggable; stopping this chain")
        return
    r = rig(f"{name}-{arm}--rig-{expect}", model["task_id"], expect, budget)
    for i, group in enumerate(presets):
        animate(f"{name}-{arm}--anim-{i}", r["task_id"], group, budget)


def golem_both_rigs(budget: tripo.Budget) -> None:
    """Owner question: biped (Mixamo) or "others" for a humanoid-shaped monster, from the same T-pose model."""
    creature("golem", True, budget, "biped", BIPED_DONOR)
    model = tripo.done("golem-neutral--model")
    rig("golem-neutral--rig-others", model["task_id"], "others", budget)


def piece(name: str, budget: tripo.Budget) -> None:
    to_model(f"{name}--model", token(prepared(name)), budget, 3000)


def armor(budget: tripo.Budget) -> None:
    img = image("armor-set--image", armor_sheet(), PROMPTS["armor"], budget)
    model = to_model("armor-set--model", img["task_id"], budget, 10000)
    tripo.run("armor-set--segment", "/mesh/segment", {"input": model["task_id"]}, budget, estimate=40)
    chk = check_output(rig_check("armor-set--rig-check", model["task_id"]))
    log(f"armor-set rig-check: {chk}")
    if chk.get("riggable") is not False:
        rig("armor-set--rig-biped", model["task_id"], "biped", budget)


BIPED_DONOR = [["preset:idle", "preset:walk", "preset:run", "preset:slash", "preset:hurt"], ["preset:fall"]]
CHAINS = {
    "asha-neutral": lambda b: creature("asha", True, b, "biped", BIPED_DONOR),
    "asha-original": lambda b: creature("asha", False, b, "biped", BIPED_DONOR),
    "wolf-neutral": lambda b: creature("wolf", True, b, "quadruped", [["preset:quadruped:walk"]]),
    "wolf-original": lambda b: creature("wolf", False, b, "quadruped", [["preset:quadruped:walk"]]),
    "hawk-neutral": lambda b: creature("hawk", True, b, "avian", []),
    "hawk-original": lambda b: creature("hawk", False, b, "avian", []),
    "sword": lambda b: piece("sword", b),
    "shield": lambda b: piece("shield", b),
    "helmet": lambda b: piece("helmet", b),
    "armor-set": armor,
    "golem-neutral": golem_both_rigs,
    "wenyn-neutral": lambda b: creature("wenyn", True, b, "biped", BIPED_DONOR),
    "kelan-neutral": lambda b: creature("kelan", True, b, "biped", BIPED_DONOR),
}


def main() -> None:
    approved = float(sys.argv[sys.argv.index("--budget") + 1])
    args = [a for a in sys.argv[1:] if not a.startswith("--") and a != sys.argv[sys.argv.index("--budget") + 1]]
    unknown = [a for a in args if a not in CHAINS]
    if unknown:
        raise SystemExit(f"unknown chain(s): {unknown}; known: {list(CHAINS)}")
    names = args or list(CHAINS)
    budget = tripo.Budget(approved)
    log(f"balance before: {tripo.balance()}  chains: {names}")

    def guarded(name: str) -> tuple[str, str]:
        try:
            CHAINS[name](budget)
            return name, "ok"
        except Exception as e:  # noqa: BLE001 - report every chain's failure, keep the others running
            log(f"FAILED {name}: {e}")
            traceback.print_exc()
            return name, f"failed: {e}"

    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(guarded, names))
    for name, status in results:
        log(f"{name}: {status}")
    log(f"batch used {budget.used:g} of {approved:g} approved credits; balance after: {tripo.balance()}")



def armor_doll() -> Path:
    """Paper-doll layout: the four pieces stacked head-to-feet in wearing order (retry after the 2x2 sheet
    lost the helmet and boots)."""
    out = WORK / "armor__doll.png"
    if not out.exists():
        rows = [("head", 300), ("torso", 520), ("legs", 520), ("boots", 360)]
        sheet = Image.new("RGB", (768, sum(h for _, h in rows)), (18, 18, 18))
        y = 0
        for piece, h in rows:
            t = Image.open(IRON / f"heavy-armor-{piece}.png").convert("RGB")
            t = t.crop((112, 112, 912, 912)).resize((h, h))
            sheet.paste(t, ((768 - h) // 2, y))
            y += h
        sheet.save(out)
    return out


def armor_retry_image(budget: tripo.Budget) -> None:
    prompt = ("These four iron armor pieces, stacked from top to bottom in wearing order (helmet, cuirass with "
              "pauldrons, plated leg armor, armored boots), are one complete suit. Show the complete suit worn by a "
              "plain smooth gray featureless mannequin standing in an A-pose facing the camera straight on: the "
              "closed helmet covering its whole head, the cuirass and pauldrons on its torso and shoulders, the plated "
              "leg armor covering both legs down to the knees and shins, and the armored boots on both feet. All four "
              "pieces must be visible. Arms straight and angled about 30 degrees away from the body, open empty hands. "
              "Keep the exact iron material, rivets, straps and wear of the reference pieces. " + STYLE_TAIL)
    image("armor-set-v2--image", armor_doll(), prompt, budget)


CHAINS["armor-set-v2-image"] = armor_retry_image


if __name__ == "__main__":
    main()
