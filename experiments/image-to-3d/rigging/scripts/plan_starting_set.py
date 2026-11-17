"""Plan the starting content set (owner-approved 2026-11-17): 10 heroes, 30 monsters, 60 equipment pieces.

  python rigging/scripts/plan_starting_set.py   ->  rigging/batches/starting-set.json

Subjects already produced in Experiment 2b (Asha, Wenyn, Kelan; clay golem, gray wolf, hunting hawk;
iron sword, shield, helmet) count toward the totals and are listed with "done": true so the runner skips
them. Hero prompts are generated from the approved roster catalog; monster prompts from the body plan.
"""
from __future__ import annotations

import json
from pathlib import Path

EXP = Path(__file__).resolve().parents[2]
REPO = EXP.parents[1]
CAND = "assets/enemies/experiments/family-affinity-v1/candidates"
FAUNA = "assets/enemies/approved/fauna-family-v1/sources"
ROSTER = "assets/heroes/approved/summonable-roster-v1"
ITEMS = "assets/equipment/approved/material-equipment-v1/items"

STYLE_TAIL = ("Full body from head to toe, nothing cropped, centered, plain light gray background, soft even studio "
              "lighting, no ground shadow, no scenery, no text, same painterly-realistic style and colors.")
T_POSE = ("Redraw {who} standing in a T-pose facing the camera straight on: arms straight out to the sides at "
          "shoulder height, palms down, fingers together, legs straight and slightly apart, feet flat. {pron} holds "
          "nothing. ")
POSES = {
    "biped": T_POSE.format(who="it", pron="It") + "Remove any weapon, shield or held object. ",
    "quadruped": ("Redraw it standing calmly in a neutral pose, seen from a three-quarter side angle, head level and "
                  "looking forward, mouth closed, all four legs straight and clearly separated, feet flat on the ground, "
                  "tail relaxed, any wings folded against the body. "),
    "avian": ("Redraw it standing upright on the ground facing the camera straight on, with both wings fully spread "
              "out horizontally to the sides like a T-pose, flight feathers fanned, tail fanned downward, legs straight. "),
    "serpentine": ("Redraw it lying stretched out almost straight on the ground in one gentle curve, seen from a "
                   "three-quarter top view, head slightly raised and looking forward, mouth closed. "),
    "hexapod": ("Redraw it standing in a neutral pose seen from a three-quarter top view, body level, all six legs "
                "evenly spread and clearly separated, feet on the ground, mandibles closed. "),
    "octopod": ("Redraw it standing in a neutral pose seen from a three-quarter top view, body level, all eight legs "
                "evenly spread and clearly separated, feet on the ground. "),
    "others": "Redraw it in a calm neutral resting shape facing the camera straight on. ",
}

# Monsters: (family dir, species id, label, body plan, height in meters). Body plan picks the rig type.
MONSTERS = [
    (CAND, "goblins/goblin-runt", "Goblin Runt", "biped", 1.0),
    (CAND, "orcs/orc-grunt", "Orc Grunt", "biped", 1.9),
    (CAND, "skeletons/skeleton-rattler", "Skeleton Rattler", "biped", 1.75),
    (CAND, "rotwalkers/rotwalker-shambler", "Rotwalker Shambler", "biped", 1.75),
    (CAND, "mummies/mummy-husk", "Mummy Husk", "biped", 1.8),
    (CAND, "lizardfolk/lizardfolk-scout", "Lizardfolk Scout", "biped", 1.8),
    (CAND, "minotaurs/minotaur-bull-kin", "Minotaur Bull-Kin", "biped", 2.3),
    (CAND, "trolls/troll-scrag", "Troll Scrag", "biped", 2.4),
    (CAND, "fungalfolk/fungalfolk-sporeling", "Fungalfolk Sporeling", "biped", 0.9),
    (CAND, "deep-ones/deep-one-fishman", "Deep One Fishman", "biped", 1.8),
    (CAND, "demons/demon-imp", "Demon Imp", "biped", 0.9),
    (CAND, "gargoyles/gargoyle-grotesque", "Gargoyle Grotesque", "biped", 1.6),
    (CAND, "werebeasts/werebeast-afflicted", "Werebeast Afflicted", "biped", 1.9),
    (CAND, "giants/giant-brute", "Giant Brute", "biped", 3.5),
    (CAND, "harpies/harpy-screecher", "Harpy Screecher", "biped", 1.6),
    (FAUNA, "boars/boar-bristle-hog", "Bristle Hog", "quadruped", 0.9),
    (FAUNA, "bears/bear-scrub-bear", "Scrub Bear", "quadruped", 1.3),
    (FAUNA, "great-cats/great-cat-wildcat", "Wildcat", "quadruped", 0.7),
    (FAUNA, "crocodilians/crocodilian-mire-caiman", "Mire Caiman", "quadruped", 0.5),
    (CAND, "dragons/dragon-whelp", "Dragon Whelp", "quadruped", 1.0),
    (FAUNA, "raptors/raptor-night-owl", "Night Owl", "avian", 0.6),
    (FAUNA, "serpents/serpent-adder", "Adder", "serpentine", 0.12),
    (FAUNA, "burrowers/burrower-soil-grub", "Soil Grub", "serpentine", 0.3),
    (CAND, "insectoids/insectoid-worker", "Insectoid Worker", "hexapod", 0.9),
    (CAND, "arachnids/arachnid-crawler", "Arachnid Crawler", "octopod", 0.7),
    (CAND, "slimes/slime-blob", "Slime Blob", "others", 0.6),
    (CAND, "elementals/elemental-wisp", "Elemental Wisp", "others", 0.8),
]
DONE_MONSTERS = [("golem", "Clay Figure golem", "biped"), ("wolf", "Gray Wolf", "quadruped"), ("hawk", "Hunting Hawk", "avian")]

# Heroes: one per common torso garment not yet covered, alternating presentation (deterministic).
HERO_TORSOS = ["belted-wool-tunic", "fitted-doublet", "leather-jerkin", "scholar-robe", "quilted-gambeson",
               "apron-over-tunic", "linen-tunic"]
DONE_HEROES = ["asha", "wenyn-amarun", "kelan-grelan"]

# Equipment: every item of ranks F, E and D (the opening game); E iron sword, shield and helmet are done.
EQUIP_RANKS = ["f", "e", "d"]
DONE_EQUIP = {"e/iron/sword", "e/iron/shield", "e/iron/heavy-armor-head"}


def source_of(base: str, rel: str) -> str:
    d = REPO / base / rel
    if (d / "normal.png").exists():
        return str((d / "normal.png").relative_to(REPO))
    versions = sorted(d.glob("normal-v*.png"), key=lambda p: int(p.stem.split("-v")[-1]))
    return str(versions[-1].relative_to(REPO))


def hero_prompt(m: dict) -> str:
    noun = {"feminine": "woman", "masculine": "man"}.get(m["genderPresentation"], "person")
    pron = {"she/her": ("her", "She"), "he/him": ("him", "He")}.get(m.get("pronouns"), ("them", "They"))
    ph, at = m["phenotype"], m["attire"]
    words = lambda s: s.replace("-", " ")
    style = words(ph["hairStyle"])
    hair = f"{words(ph['hairColor'])} {words(ph['hairTexture'])} hair in {'an' if style[0] in 'aeiou' else 'a'} {style} style"
    facial = "" if ph.get("facialHair") in (None, "none") else f", {words(ph['facialHair'])}"
    garments = ", ".join(words(at[k]) for k in ("headwear", "torso", "arms", "legwear", "footwear") if at.get(k) and at[k] != "none")
    traits = "; ".join([t for t in m.get("visualTraits", []) if not t.startswith("no ")][:4])
    return (f"The exact same adult {noun} as the reference: same face, {words(ph['skinTone'])} skin, {hair}{facial}, "
            f"{m['bodyFrame']} {m['bodyBuild']} build. Same {words(at['material'])} clothing: {garments}; keep every "
            f"color, pattern and detail, including {traits}. " + T_POSE.format(who=pron[0], pron=pron[1]) + STYLE_TAIL)


def main() -> None:
    subjects = []
    for base, rel, label, body, height in MONSTERS:
        sid = rel.split("/")[1]
        subjects.append({"id": sid, "kind": "monster", "label": label, "body": body, "height": height,
                         "source": source_of(base, rel),
                         "prompt": f"The exact same {label.lower()} as the reference: same face, body shape and proportions, "
                                   f"skin, fur, scales or surface, colors, markings, clothing and accessories. "
                                   + POSES[body] + STYLE_TAIL})
    for sid, label, body in DONE_MONSTERS:
        subjects.append({"id": sid, "kind": "monster", "label": label, "body": body, "done": True})

    catalog = json.loads((REPO / ROSTER / "catalog.json").read_text())
    picked, last_gender = [], None
    for torso in HERO_TORSOS:
        pool = [e for e in catalog["entries"] if e["draft"]["manifest"]["attire"]["torso"] == torso
                and e["heroId"] not in DONE_HEROES and e["heroId"] not in picked]
        pool.sort(key=lambda e: (e["draft"]["manifest"]["genderPresentation"] == last_gender, e["designOrdinal"]))
        choice = pool[0]
        picked.append(choice["heroId"])
        last_gender = choice["draft"]["manifest"]["genderPresentation"]
        m = choice["draft"]["manifest"]
        subjects.append({"id": choice["heroId"], "kind": "hero", "label": m["displayName"], "body": "biped",
                         "height": round(m["heightCm"] / 100, 2), "source": f"{ROSTER}/sources/{choice['heroId']}/summon.png",
                         "prompt": hero_prompt(m)})
    for sid in DONE_HEROES:
        subjects.append({"id": sid, "kind": "hero", "body": "biped", "done": True})

    for rank in EQUIP_RANKS:
        for mat_dir in sorted((REPO / ITEMS / rank).iterdir()):
            for png in sorted(mat_dir.glob("*.png")):
                key = f"{rank}/{mat_dir.name}/{png.stem}"
                subjects.append({"id": f"{rank}-{mat_dir.name}-{png.stem}", "kind": "equipment", "body": "prop",
                                 "label": f"{rank.upper()} {mat_dir.name} {png.stem}".replace("-", " "),
                                 "source": str(png.relative_to(REPO)), **({"done": True} if key in DONE_EQUIP else {})})

    out = EXP / "rigging" / "batches" / "starting-set.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"name": "starting-set", "approved": "2026-11-17", "subjects": subjects}, indent=1) + "\n")
    count = lambda k, done=None: sum(1 for s in subjects if s["kind"] == k and (done is None or bool(s.get("done")) == done))
    print(f"heroes {count('hero')} ({count('hero', False)} new), monsters {count('monster')} ({count('monster', False)} new), "
          f"equipment {count('equipment')} ({count('equipment', False)} new) -> {out.relative_to(EXP)}")


if __name__ == "__main__":
    main()
