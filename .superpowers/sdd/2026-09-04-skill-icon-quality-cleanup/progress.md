# SDD ledger — plan: /home/joao/.codex/worktrees/ddb0/summonlab/docs/superpowers/plans/2026-09-04-skill-icon-quality-cleanup.md

Branch start: `99fc476375a7494fc09ff67bf632c1b1a295c60f`
Spec: `/home/joao/.codex/worktrees/ddb0/summonlab/docs/superpowers/specs/2026-09-04-skill-icon-quality-cleanup-design.md`

## Preflight scan

| Scope | Produces / consumes | Finding |
| --- | --- | --- |
| Task 1 self | Strict schemas, tests, and authored finding inventory | Internally consistent; tests target observable schema acceptance/rejection and inventory completeness. |
| Task 2 self | Cleanup library/exporter and generated 456-record manifest | Internally consistent; write/check modes and byte-bound authorities match the spec. |
| Task 3 self | Six frame-v5 packets plus one backing-v5 packet | Internally consistent; existing F-v5 is deliberately reused rather than regenerated. |
| Task 4 self | Geometry-v2 extraction, composition, inspection, finalization | Internally consistent; deterministic pixel behavior has explicit tests and encoding settings. |
| Task 5 self | Seven new shared candidates plus 456 deterministic recompositions | Internally consistent except “one batch” must be reconciled with sequential SDD implementer ownership; ruled below. |
| Task 6 self | Cleanup-specific revision packets and no-replace persister | Internally consistent; this is a distinct coordinator cleanup protocol, not an ordinary SkillIconTarget packet. |
| Task 7 self | 28 semantic revisions and complete review sheets | Internally consistent; progress is collision-safe and technical completion precedes owner review. |
| Task 8 self | Owner review, selection, promotion, and wiki refresh | Owner-authored acceptance is externally authoritative and cannot be fabricated; ruled below. |
| Tasks 1 → 2 | Schemas/findings source → generated manifest/findings | Clean interface; Task 2 consumes the exact authored inventory and exported contracts. |
| Tasks 1 → 8 | Review/selection schemas → owner review and selection | Clean interface; Task 8 must use the strict hashes and explicit symbolic decisions. |
| Tasks 2 → 4 | Cleanup library/manifest → deterministic finalizer | Clean interface; Task 4 extends the same library and consumes generated inventory. |
| Tasks 2 → 5 | 456-record manifest → recomposition inputs/outputs | Clean interface; Task 5 materializes paths already derived by Task 2. |
| Tasks 2 → 6 | Exporter/library → immutable revision packets | Clean interface; Task 6 extends rather than replaces authority loading. |
| Tasks 2 → 8 | Cleanup manifest → selected cleanup authority | Clean interface; selection remains hash-bound to the frozen manifest. |
| Tasks 3 → 5 | Target/assignment packets → seven producer jobs | Clean interface; packet ownership is one candidate/result pair per job. |
| Tasks 4 → 5 | Finalizer/compositor → 456 candidates | Clean interface; generation supplies shared layers before deterministic composition. |
| Tasks 4 → 7 | Finalizer/review renderer → revised catalog/review sheets | Clean interface; revised interiors are selected by the finalizer without changing deterministic-only records. |
| Tasks 5 → 6 | Current cleanup composites/shared layers → revision references | Clean interface; references are hash-bound and purpose-limited. |
| Tasks 5 → 7 | Completed deterministic set → targeted revision batch | Clean interface; all base composites remain present during semantic cleanup. |
| Tasks 6 → 7 | Revision packets/persister → 28 generated revisions | Clean interface; no-replace persistence makes partial progress resumable. |
| Tasks 7 → 8 | Completed review package → owner decision/selection | Clean interface but crosses a real owner-authority boundary; ruled below. |
| Task 8 → wiki exporter | Valid selection → cleanup-derived WebP assets | Clean interface; without accepted selection, historical mass-production remains authoritative. |

Ruling: “one batch” in Tasks 5 and 7 means continuous no-checkpoint production, while individual producer assignments run sequentially under SDD’s single-implementer rule — this preserves collision safety and avoids concurrent Git writes — if wrong, the cost is longer wall-clock time rather than changed output semantics.

Ruling: Task 6/7 semantic cleanup packets use the dedicated cleanup revision protocol plus the built-in image-generation route, not `summonlab-skill-icon-production`, because that producer accepts only ordinary manifest-bound SkillIconTarget assignments and explicitly forbids complete-icon references — if wrong, the cost is revising the cleanup-specific provenance protocol before selection.

Ruling: Task 8 implementation and tests may be prepared, but an `accepted` owner review, symbolic keep/remove decisions, promotion, selection, and wiki replacement require the user’s actual review of the generated package — this prevents false owner provenance — if wrong, the cost is one additional review turn before the wiki can change.

Ruling: the user-authorized deletion target is exactly `/home/joao/Documents/summonlab/skills/summonlab-image-production/scripts/__pycache__/`; delete it only after all executable repository work and validation in this run, never via a broad glob — if wrong, the cost is regeneration of Python bytecode cache only.

Task 1: started (base `99fc476375a7494fc09ff67bf632c1b1a295c60f`)
Baseline note: the broad `test:skill-icons` run was manually stopped after two minutes of CPU-bound execution to avoid competing with Task 1's focused TDD run; this was an interruption, not a test failure. The full suite remains a final validation gate.
Task 1: fix round 1/5 (2 addressed, 0 open; commit `d92f2c82a`)
Task 1: complete (commits `99fc476`..`d92f2c8`, review clean)
Task 2: started (base `d92f2c82abd456d2b73b6d9c10add2d4a10bee2c`)
Task 2: fix round 1/5 (2 addressed, 1 open — race regression synchronization; commit `e6f2a68de`)
Task 2: fix round 2/5 (1 addressed, 0 open; commit `53f63cd23`)
Task 2: complete (commits `d92f2c8`..`53f63cd`, review clean)
Task 3: started (base `53f63cd23`)
Task 3: fix round 1/5 (1 addressed, 0 open — point-up frame orientation; commit `f8300638a`)
Task 3: complete (commits `53f63cd`..`f830063`, review clean)
Task 4: started (base `f8300638a`)
Task 4: fix round 1/5 (4 addressed, 2 open — missing check drift and unsafe parent preflight; commit `891d2bc98`)
Task 4: fix round 2/5 (2 addressed, 0 open; commit `80081a3b2`)
Task 4: complete (commits `f830063`..`80081a3`, review clean)
Task 5: started (base `80081a3b2546b6e70bcdf38204f29c12d719190f`)
Task 5: shared-layer job `charcoal-forged-stone-v5` terminally failed after 2/2 authorized image calls; no candidate retained; verified failure result commit `6e686438f`.
Task 5: stopped per plan after terminal shared-layer failure; remaining six frame jobs were not dispatched.
Ruling: do not weaken profile-v3 normalization or continue the batch after the backing-v5 terminal result; propose a separately approved revision-6 recovery packet with a wider pure-green clearance corridor — if wrong, the cost is one additional backing generation revision before the six frame jobs resume.
Task 5 recovery spike: direct-alpha edit returned 1254×1254 RGB with a painted checkerboard, `hasAlpha=false`, and zero transparent pixels; direct-alpha production is not viable through the built-in tool.
Ruling: owner approved a new `skill-icon-geometry-role-mask-v1` / `summonlab-skill-icon-production-v5` route that preserves profile v3 but replaces its brittle provider-edge eligibility checks with deterministic geometry-v2 clearing and unchanged strict retained-output validation — if wrong, the cost is reverting the additive profile and its revision-6 packets; all v5 evidence remains immutable.
Task 5A: started (base `6e686438f`)
Task 5A: fix round 1/5 (1 addressed, 1 open — retained in-mask matte contamination; commit `ba1f6efce`)
Task 5A: fix round 2/5 (1 addressed, 0 open — multiscale checker detection; commit `a04c7065c`)
Task 5A: complete (commits `6e68643`..`a04c706`, review clean)
Task 5B: started (base `a04c7065c34b7dba953c9c6a1429d4dae427a35f`)
Task 5B: implementation complete (commit `ace379bd5`; review pending)
Task 5B: fix round 1/5 (1 open — packet exporter must fail closed on existing-byte drift)
Task 5B: fix round 1/5 (1 addressed, 0 open; commit `063569c1a`)
Task 5B: complete (commits `a04c706`..`063569c`, review clean)
Task 5C: shared-layer raster production started (base `063569c1ac29c4271f3e6073366ea3e09b3e4b82`)
Task 5C: shared-layer `charcoal-forged-stone-v6` complete (commit `0262ede1c`; 1/1 call; producer verification and task review clean)
Task 5C: shared-layer `rarity-frame-e-v6` retained as `revise` (commit `74e679bb9`; 1/2 calls; green fringe found after persistence; producer protocol error prevented the permitted correction)
Ruling: stop frame-v6 production and issue frame-v7 packets with an explicit hard-edge/no-green-spill invariant before any further image calls. Preserve attempted E-v6 evidence; supersede only the five unattempted D/C/B/A/S-v6 packets. F-v5 and backing-v6 remain canonical. If wrong, the cost is one packet revision, not corrupted shared layers.
Task 5D: frame-v7 recovery packets started (base `74e679bb9`)
Task 5D: complete (commit `209206f46`; review clean)
Task 5E: no-spill frame-v7 raster production started (base `209206f464376255ef9cbbe7a75006ed1241beca`)
Task 5E: `rarity-frame-e-v7` retained as `revise` (commit `a69846420`; 1/2 calls; the same green edge trace survived normalization)
Task 5E: stopped before D/C/B/A/S. Black-matte spike produced visually clean edges but the strict RGB matte was not pixel-uniform and a black-key profile would risk erasing dark frame recesses.
Ruling: introduce an additive strict-despill geometry profile instead of changing profile v4 or switching matte colors. Preserve every previous result; issue revision-8 frame packets on the new tuple. If wrong, the cost is an isolated additive profile and packet revision; historical candidates remain auditable.
Task 5F: strict-despill profile and frame-v8 packet implementation started (base `a69846420`)
Task 5F: implementation complete (commit `187e828a2`; review found post-resize green reintroduction)
Task 5F: fix round 1/5 (1 open — enforce strict green ceiling on final retained pixels after Lanczos resize)
Task 5F: fix round 1/5 (1 addressed, 0 open; commit `c49018ceb`)
Task 5F: complete (commits `a698464`..`c49018c`; review clean)
Task 5G: strict-despill frame-v8 raster production started (base `c49018cebd63204fb1ed72fc3ef4ac305c2dda4e`)
Task 5G: `rarity-frame-e-v8` retained as candidate evidence (commit `aef28df48`; 2/2 calls), but coordinator inspection found 81,134 bright-magenta visible pixels created by strict green de-spill; result is not eligible for canonical mapping.
Task 5G: stopped before D/C/B/A/S. The strict green clamp satisfies its numerical invariant but is visually invalid after low-alpha unmatting.
Ruling: spike a black-matte, geometry-masked normalization that never color-keys green. Preserve all v8 evidence; no further frame generation until the technical raster is visually clean.
Task 5H spike: black-matte profile prototype passed role inspection with zero forbidden/aperture alpha, zero alpha-zero RGB residue, one 96px component, and no visible halo. Selected transition is maxRGB <=4 transparent, >=16 opaque, linear black unmatte between, geometry-v2 inward-only 4x4 coverage.
Ruling: implement the tested black-matte algorithm as an additive frame-only profile and issue revision-9 frame packets. Preserve v1-v5 behavior and every prior result. If wrong, the cost is one isolated profile/packet revision; no prior evidence changes.
Task 5H: black-matte profile and frame-v9 packet implementation started (base `aef28df48`)
Task 5H: complete (commit `2d73dd40b`; review clean)
Task 5I: black-matte frame-v9 raster production started (base `2d73dd40b10fae9c524a54546b6946d8174e4d89`)
Task 5I: shared-layer `rarity-frame-e-v9` complete (commit `e445d34a6`; 1/1 call; candidate, no halo)
Task 5I: shared-layer `rarity-frame-d-v9` complete (commit `4cbfc802d`; 1/1 call; candidate, no halo)
Task 5I: shared-layer `rarity-frame-c-v9` complete (commit `dd9ec1adc`; 1/1 call; candidate, no halo)
Task 5I: shared-layer `rarity-frame-b-v9` complete (commit `17968afea`; 1/1 call; candidate, no halo)
Task 5I: shared-layer `rarity-frame-a-v9` complete (commit `9d659b258`; 2/2 calls; candidate, no halo)
Task 5I: shared-layer `rarity-frame-s-v9` complete (commit `b54403875`; 2/2 calls; candidate, no halo)
Task 5I: all seven canonical generated shared layers now exist and `validate:skill-icons` passes.
Task 5J: cleanup finalizer execution-binding repair started (base `b54403875`); current finalizer incorrectly expects role/rarity fields on result-v2 instead of authenticating them from target-v2.
Task 5J: implementation complete (commit `a857901e5`; review found canonical-reference substitution gap)
Task 5J: fix round 1/5 (1 open — pin exact ordered path/purpose/hash tuple for each shared-layer job)
Task 5J: fix round 1/5 (1 addressed, 0 open; commit `6e0870dfb`)
Task 5J: complete (commits `b544038`..`6e0870d`; review clean)
Task 5K: materialize 456 deterministic cleanup composites started (base `6e0870dfb80ae7e73fc6efb81818104168df21cc`)
Task 5K: stopped before commit after full-size audit found inherited `rarity-frame-f-v5` visually invalid (severe magenta aperture speckling and contour residue). All 1,368 deterministic outputs were untracked and were discarded; historical sources remain unchanged.
Ruling: supersede F-v5 only in cleanup canonical authority with a new F-v9 packet on the already validated black-matte producer-v7 route, then rematerialize the entire catalog. Preserve F-v5 as immutable audit evidence. If wrong, the cost is one additive F packet/result/candidate; no historical byte changes.
Task 5L: F-v9 packet and canonical-binding repair started (base `6e0870dfb80ae7e73fc6efb81818104168df21cc`)
Task 5L: complete (commit `38cb548ad`; review clean)
Task 5M: F-v9 raster production started (base `38cb548adde1b7f17592e63692fbabe78a5092be`)
Task 5M: fix round 1/5 (2 addressed, 0 open — explicit full-size finding and honest reconstructed timing; commit `7844dfebc`)
Task 5M: complete (commits `38cb548`..`7844dfe`; review clean)
Task 5N: clean deterministic catalog materialization started (base `7844dfebc`)
Task 5N: complete (commit `51546579c`; review clean)
Task 5: complete (commits `80081a3`..`5154657`; shared layers and 456 deterministic cleanup candidates reviewed clean)
Task 6: targeted semantic revision protocol started (base `51546579c0e67796e53bffa94e0f4983d882d054`)
Task 6: implementation complete (commit `cbddf2a2c`; review found 4 P1 protocol defects and 1 P2 CI-coverage omission)
Task 6: fix round 1/5 (5 open — parent-swap escape, post-publish parent reauthentication, native provider envelope, rollback unlink TOCTOU, standard-suite coverage)
Task 6: fix round 1/5 (4 addressed, 1 open; commit `1d5047334` — exact pre-existing packet through outside-root symlinked parent still accepted)
Task 6: fix round 2/5 (1 open — validate ancestors for exact-artifact preflight/check path)
Task 6: fix round 2/5 (1 addressed, 1 new minor open; commit `6a4b61f8e` — FIFO leaf can block before non-regular rejection)
Task 6: fix round 3/5 (1 open — open preflight leaves nonblocking before type validation)
Task 6: fix round 3/5 (1 addressed, 0 open; commit `4658cbfa0`)
Task 6: complete (commits `5154657`..`4658cbf`; review clean)
Task 7: 28 semantic revisions and review package started (base `4658cbfa00df009930f4406547775fee5e70fa67`)
Task 7: v1 batch complete but review failed (commit `b3251395a`; 23 candidate clipping contradictions, 2 explicit revise receipts, unauditable v1 timing/order claims)
Ruling: enforce the strict complete-subject interpretation because it directly matches the user's frame-overlap/positioning cleanup requirement. Preserve all v1 evidence. Recover 21 cropped candidates via the spike-proven uniform deterministic inset, carry three passing candidates through explicit identity v2 evidence, and regenerate only four intrinsically bad sources under additive v2 packets. If wrong, the cost is append-only v2 evidence; no v1 or historical byte changes.
Task 7: fix round 1/5 (3 open — append-only v2 recovery, complete 28-candidate selection, honest v2 execution evidence)
Task 7A: v2 protocol and 24 deterministic recoveries started (base `b3251395a`)
Task 7A: implementation complete (commit `437108d0c`; review found 4 P1 protocol defects and 1 P2 mislabeled inspection artifact)
Task 7: fix round 1/5 (visual clipping addressed for 24 outputs, but 5 protocol/review findings remain open)
Task 7: fix round 2/5 (5 open — generation persistence, arbitrary revision chaining, receipt authentication, honest completion timing, true 1024 review evidence)
Task 7: fix round 2/5 (5 addressed, 2 new P1 open; commit `dda9308df` — post-audit core replacement and cross-target identity adoption)
Task 7: fix round 3/5 (2 open — revalidate all five artifacts after audit publication; bind identity transform to immediate predecessor)
Task 7: fix round 3/5 (2 addressed, 0 open; commit `0c479959b`)
Task 7B: four generation-v2 recovery jobs started (base `0c479959bd6a02ecda368bfe16146c7fa93d7624`)
Task 6: fix round 1 complete (commit `1d5047334`; all 5 findings have RED/GREEN regressions; 28 authority-updated packet JSON files rematerialized; central skill-icon suite 406/406 green; pushed and clean)
Task 6: fix round 2 validated (RED/GREEN in check and write modes; cleanup suite 21/21; central suite 408/408; delivery pending)
Task 6: fix round 2 complete (commit `6a4b61f8e`; exact-packet ancestor symlink rejected in both modes; pushed and clean)
Task 6: fix round 3 validated (FIFO preflight RED/GREEN; cleanup suite 22/22; typecheck and deterministic check green; delivery pending)
Task 6: fix round 3 complete (commit `4658cbfa0`; FIFO artifacts reject without a writer; pushed and clean)
Task 7: complete; all 28 immutable packets were processed in sorted path order with 56 built-in image-generation calls and immediate create-only receipts. The terminal batch is 26 `candidate`, 2 honest `revise`, and 0 provider failures. All 456 deterministic base composites remain unchanged; the 28 revision composites are selected only for review layouts, not owner selection or wiki promotion. The complete 23-PNG review package, zero-write checks, full technical validation, and immutable-byte audit are recorded in `task-7-report.md`.
Task 7A: deterministic v2 recovery complete (commit `437108d0c`, pushed): the Task 7 v1 completion claim is retracted; 28 v2 packets and 24 current-run candidate-v2 receipts are materialized with zero generation calls. The exact four generation-v2 targets remain pending, and final review/complete gates intentionally fail closed. No owner acceptance, promotion, selection, or wiki replacement occurred.
Task 7: fix round 3/5 complete (commit `0c479959b`, pushed) — post-audit publication now reauthenticates all four core artifacts plus the audit by canonical named path/inode/bytes before returning a candidate; a foreign composite replacement at `afterPublish(4)` fails closed, preserves the foreign inode, and removes the owned audit. Identity-adoption-vN transform interior/composite bindings must exactly equal the immediate predecessor receipt in contract, derivation, persistence, and finalizer checks. No image calls or V1/V2/V3 evidence writes occurred; targeted tests/typecheck/packet/recovery checks and immutable aggregates are green.
