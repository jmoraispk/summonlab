"""Combat clips from Tripo's v1.0 biped rig (owner-approved test, 2026-11-18, ~75 credits).

  python rigging/scripts/combat_v1.py --budget 100

Re-rigs Asha's T-pose model (the same model as `asha-neutral--rig-biped`) with `v1.0-20240301`, whose
retarget library has 90+ presets, and asks for five combat clips. The v3.0 rig only offers 11 presets with
no punch, kick, combat hit reaction or death. Tries `spec: mixamo` first so the clips can share bone
names with the v3.0 rigs; falls back to Tripo's native names if v1.0 rejects it.
"""
import sys

import tripo
from batch_sample import log

V1 = "v1.0-20240301"
COMBAT = ["preset:biped:chop", "preset:biped:box_01", "preset:biped:front_kick_01", "preset:biped:hit_to_head",
          "preset:biped:defeat_02"]


def main() -> None:
    budget = tripo.Budget(float(sys.argv[sys.argv.index("--budget") + 1]))
    model = tripo.done("asha-neutral--model")
    log(f"balance before: {tripo.balance()}")
    try:
        rig = tripo.run("asha-neutral--rig-v1-mixamo", "/animations/rig",
                        {"model": V1, "input": model["task_id"], "rig_type": "biped", "spec": "mixamo", "out_format": "glb"},
                        budget, estimate=25)
    except RuntimeError as e:
        log(f"v1.0 with spec=mixamo failed ({str(e)[:160]}); retrying with Tripo's native names")
        rig = tripo.run("asha-neutral--rig-v1", "/animations/rig",
                        {"model": V1, "input": model["task_id"], "rig_type": "biped", "out_format": "glb"}, budget, estimate=25)
    tripo.run("asha-neutral--anim-v1-combat", "/animations/retarget",
              {"input": rig["task_id"], "animations": COMBAT, "animate_in_place": True, "export_with_geometry": True},
              budget, estimate=10 * len(COMBAT))
    log(f"used {budget.used:g} credits; balance after: {tripo.balance()}")


if __name__ == "__main__":
    main()
