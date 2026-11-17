# Experiment 2 decisions

Durable owner answers, so later turns do not rediscover them.

| Date | Decision | Status |
| --- | --- | --- |
| 2026-11-17 | Use the Tripo API for the pipeline; the owner loaded API credits. Studio steps (`TRIPO-CHECKLIST.md`) are superseded. | accepted |
| 2026-11-17 | No local models: no TRELLIS, Hunyuan3D-2 or Qwen downloads; they make the workflow clunky and use a lot of disk. | accepted |
| 2026-11-17 | Tripo also does the animation (owner's intention); code retargeting is only a fallback or comparison. | accepted |
| 2026-11-17 | No Segment for weapons: weapons are separate pieces, and hit regions are derived from the skeleton in code. | accepted |
| 2026-11-17 | Generate a neutral-pose image for every creature before image-to-3D (Experiment 2b evidence in `REPORT-rigging.md`). | accepted |
| 2026-11-17 | Equipment as individual pieces; the one-image armor set dropped pieces twice. | accepted |
| 2026-11-17 | Biped (Mixamo) rig for every two-armed, two-legged body, from the T-pose image; rig type from the catalog family, rig-check only for `riggable`. | proposed, awaiting owner take |
| 2026-11-17 | Hit regions must be marked carefully: bone-attached volumes plus purity and bone-inside-mesh checks. | revised after owner review |
| 2026-11-17 | A shield straps to the forearm; a ragdoll must not ball up. | revised after owner review |
| 2026-11-17 | Starting content set: about 30 monsters, 10 heroes and 60 equipment pieces. | accepted (sizing) |
| 2026-11-17 | API spend is billed separately from Studio credits; the owner tops up the API wallet as needed. Each new paid batch still gets a one-line estimate first. | accepted |
| 2026-11-17 | Hit volumes are roughly sufficient; add finer ones (hands above all) for injury precision. Done: 19 regions incl. palm and every finger phalanx. | accepted, revised |
| 2026-11-17 | Clay golem from its T-pose image, rigged both as biped and as `others`, to settle the rig-type question. | run |
| 2026-11-17 | Two more heroes, assistant's choice: Wenyn Amarun (183 cm, powerful) and Kelan Grelan (155 cm, sturdy, voluminous hair). | run |
