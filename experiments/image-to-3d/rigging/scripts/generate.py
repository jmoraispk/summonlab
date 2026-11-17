"""Experiment 2 generation batch on Tripo.

  python rigging/scripts/generate.py images --budget 40
  python rigging/scripts/generate.py models --budget 360

Stage "images" makes the neutral-pose goblin candidates and a stand-alone spear image.
Stage "models" runs image-to-3D (Smart Mesh + PBR) for every subject, one HD + retopology comparison,
and Segment on the crouched goblin. Neutral/spear inputs come from rigging/choices.json, written after
the generated images are reviewed and cut out.
"""
import json
import sys
from pathlib import Path

import tripo

EXP = Path(__file__).resolve().parents[2]
SRC = EXP / "work" / "sources"
CHOICES = EXP / "rigging" / "choices.json"
MODEL = "v3.1-20260211"

NEUTRAL_PROMPT = (
    "The exact same goblin character as the reference: same face, wrinkles, ears, earrings, skin color, "
    "body proportions, loincloth, belt and ankle band. Redraw him standing upright in a neutral A-pose, "
    "facing the camera straight on: arms straight and angled about 30 degrees away from the body, open empty "
    "hands with fingers relaxed, palms facing the thighs, legs straight and slightly apart, feet flat on the "
    "ground. He holds no weapon and nothing in his hands. Full body from head to toes, nothing cropped, "
    "plain light gray background, soft even studio lighting, no shadows on the ground, same painterly-realistic style."
)
SPEAR_PROMPT = (
    "Extract only the goblin's crude spear from the reference: the wooden shaft with leather bindings and the "
    "iron leaf-shaped spearhead. Show the complete spear alone, full length, lying horizontally, viewed from the "
    "side, nothing cropped, no hands, no character, plain light gray background, soft even lighting, same "
    "painterly-realistic style and colors."
)


def images(budget: tripo.Budget) -> None:
    goblin = tripo.upload(SRC / "goblin-runt" / "clean.png")
    tripo.run("img-goblin-neutral-apose", "/generation/image-to-image",
              {"model": "seedream_v5", "input": goblin, "prompt": NEUTRAL_PROMPT}, budget, estimate=10)
    tripo.run("img-goblin-neutral-tpose-template", "/generation/image-to-image",
              {"model": "seedream_v5", "input": goblin, "template": "t_pose",
               "prompt": "Same goblin, no weapon, empty hands, full body, plain light gray background."},
              budget, estimate=10)
    tripo.run("img-spear", "/generation/image-to-image",
              {"model": "seedream_v5", "input": goblin, "template": "asset_extraction", "prompt": SPEAR_PROMPT},
              budget, estimate=10)


def to_model(step: str, image: Path, budget: tripo.Budget, face_limit: int, hd: bool = False) -> dict:
    token = tripo.upload(image)
    payload = {"model": MODEL, "input": token, "texture": True, "pbr": True, "texture_quality": "standard"}
    if hd:
        payload.update(geometry_quality="detailed", texture_quality="detailed")
        estimate = 60
    else:
        payload.update(smart_low_poly=True, face_limit=face_limit)
        estimate = 40
    return tripo.run(step, "/generation/image-to-model", payload, budget, estimate=estimate)


def models(budget: tripo.Budget) -> None:
    choices = json.loads(CHOICES.read_text())
    neutral = EXP / choices["goblin-neutral"]
    spear = EXP / choices["spear"]
    crouched = to_model("3d-goblin-crouched", SRC / "goblin-runt" / "clean.png", budget, 15000)
    to_model("3d-goblin-neutral", neutral, budget, 15000)
    to_model("3d-spear", spear, budget, 3000)
    to_model("3d-hog", SRC / "boar-bristle-hog" / "clean.png", budget, 15000)
    to_model("3d-raider", SRC / "goblin-raider" / "clean.png", budget, 15000)
    # HD + retopology comparison on the neutral goblin.
    hd = to_model("3d-goblin-neutral-hd", neutral, budget, 0, hd=True)
    tripo.run("retopo-goblin-neutral-hd", "/mesh/decimate",
              {"model": "v3.0", "input": hd["task_id"], "face_limit": 15000, "bake": True}, budget, estimate=35)
    # Split the fused spear off the crouched goblin.
    tripo.run("segment-goblin-crouched", "/mesh/segment",
              {"input": crouched["task_id"]}, budget, estimate=40)


if __name__ == "__main__":
    stage = sys.argv[1]
    approved = float(sys.argv[sys.argv.index("--budget") + 1])
    b = tripo.Budget(approved)
    print("balance before:", tripo.balance())
    {"images": images, "models": models}[stage](b)
    print(f"stage {stage}: {b.used:g} credits used of {approved:g} approved; balance after:", tripo.balance())
