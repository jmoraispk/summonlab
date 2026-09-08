# Image-production skill and affinity workload plan

Status: **live image generation complete; all 60 manifest-bound targets and the 24-image Breadth
round are integrated, while human acceptance and conditional future workloads remain pending**

Date: **2026-08-29**

Scope: reusable image-production skill, structured target manifests, elemental-affinity grammar,
species preservation, compound goblin variation, parallel image-generation workloads, provenance,
review, and concurrency measurement.

This is a post-production extension of the retained Pack 2 monster language. It uses that monster
language as a controlled test bed without changing or automatically promoting any accepted Pack 2
candidate. Generated results remain experimental approval candidates until a human records a review
decision.

## Execution record

- 2026-08-29: Completed generation-first Breadth production. All 24 Goblin, Tunnel Boar, Cave
  Drake, and Tower Basilisk coordinates now have collision-free retained images and verified result
  records: 15 producer candidates and nine bounded revisions across 44 model calls. The exact
  `breadth-v1` round is integrated, the 24-image opaque contact sheet is reproducible at SHA-256
  `77b340d3f428f095074ef6c24c6d20d526b8e21f321adfd1938d88e2dedb582a`, and the global catalog
  contains all 60 live executions with zero missing results, path conflicts, or integration errors.
  No output is human-approved or promoted. Conditional final-controlled reruns and Load/Scale
  sentinels remain non-live future work and were not fabricated as current image deliverables.
- 2026-08-29: Changed the operating sequence from review-first to generation-first at the product
  owner's direction. Valid, collision-free assignments may now produce experimental candidates
  immediately; human review remains mandatory only for acceptance, promotion, and later-pack rule
  decisions. The first three-worker wave completed Goblin Normal, Tunnel Boar Fire, and Cave Drake
  Normal, deliberately covering humanoid, organic quadruped, and draconic anatomy. Cave Drake is a
  verified producer candidate; Goblin is a visually passing `revise` with a strict first-prompt
  newline provenance failure, and Tunnel Boar is a visually strong `revise` whose far rear hoof
  remained occluded after correction. All three result verifiers pass, catalog integration reports
  no collisions or integration errors, and no image was self-promoted.
- 2026-08-29: Replaced the ambiguous stage-only schedule with a deterministic v2 allocation of nine
  named workloads: Final Canary, Final Pilot, Controlled A/B/C, Breadth Canary, Breadth-8, Load-12,
  and Scale-16. The first five partition all 24 final-controlled targets exactly; the two-job
  Breadth canary is exactly Goblin Normal plus Tunnel Boar Fire; the remaining workloads preserve
  the reviewed 24 Breadth targets and 14 future sentinels without path collisions. A zero-write
  Breadth readiness check now proves all 24 target/assignment pairs, both canaries, current skill
  and reference hashes, and 48 absent owned outputs. The event-v3 state machine separately records
  job claims and actual worker starts, so only admitted starts contribute to concurrency evidence.
  No manifest, dispatch gate, event, result, review, or image was created by this preparation.
- 2026-08-29: Made the reviewed exact-concurrency allocation executable only through a guarded v2
  materializer. Each fresh plan now binds the allocation, named workload, dispatch gate, optional sentinel
  activation receipt, and every target and assignment hash. V2 preflight preserves those bindings;
  dispatch, reporting, and completion revalidate the current snapshot. The interim event-v2 journal
  established recorder-owned sequence and preflight hashes, but it does not qualify new concurrency
  measurements because a dispatch was not proof of an admitted worker start. Event v3 supersedes
  it before live execution. Report v3 binds all manifests, and a final-controlled run cannot count
  without its valid controlled contact sheet. No live wave, gate, sentinel, or image was activated
  by this tooling slice.
- 2026-08-29: Repaired the staged concurrency proof so Load-12 depends on the exact promoted
  Breadth-8 run and Scale-16 depends on the exact promoted Load-12 run, removing the prior circular
  requirement for a fully completed breadth round before its own targets could run. Every
  post-canary gate now carries re-derived hashes for the precise report, results, retained images,
  quality rate, retry rate, and critical failures. Breadth also requires the exact Goblin Normal
  and Tunnel Boar Fire canaries to pass on their first attempts. Capacity, throttle, timeout, and
  malformed-output failures all participate in the three-failure launch stop.
- 2026-08-29: Hardened the reusable workflow boundary for high parallelism. Exclusive persistence
  now cleans up only paths created by the current worker, preserves another worker's collision
  bytes, and rejects symlinks in every output-parent component. A new fresh-agent, no-image Goblin
  preflight is reproducible rather than self-attested: validation re-runs the installed skill's
  target validator and prompt renderer, verifies the framed ten-file skill digest against the
  repository, checks both routed reference hashes and dimensions, and proves both owned outputs
  remain absent.
- 2026-08-29: Made review-round correction evidence safe and current. Before finalization, the
  explicit reviewer's latest DB projection can replace a stale export while prior canonical
  snapshots are preserved in append-only history. After a receipt exists, the export is frozen.
  Finalization re-reads DB-authentic, current-candidate evidence before and again under the shared
  publication lock; unavailable, stale, or superseded evidence is zero-write.
- 2026-08-29: Replaced mixed review aggregates with three exact 24-target evidence rounds:
  `baseline-v1`, `final-controlled-v1`, and `breadth-v1`. Each round now validates every target,
  assignment, result, retained image byte, ID, retry ceiling, and owned path before publishing its
  catalog and incomplete evaluation, then publishes a hash-bound integration receipt last. The
  baseline check coexists with regression manifests; the dedicated final namespace remains exact.
  The existing baseline is now materialized in that structure with 24 results, 21 producer
  candidates, and a verified `1920×1080` opaque contact sheet; it remains unapproved.
- 2026-08-29: Added reviewer-scoped round evidence export, deterministic opaque 24-image contact
  sheets with JSON sidecars, and receipt-last human-acknowledged final evaluation. Controlled rounds
  enforce all recognition and quality thresholds. Breadth requires all 24 current-hash human
  reviews, all four species, zero workflow violations, and at least one human-accepted Cave Drake
  or Tower Basilisk. Incomplete final and Breadth checks are verified zero-write operations.
- 2026-08-29: Turned the eight later-pack visual rules into a versioned proposal and append-only
  human decision contract. Acceptance cannot be passed on a CLI: it is recorded per actor in the
  database only after current final-round readiness, then exported as a strict v2 artifact bound to
  the proposal, plan, activation, catalog, reviews, execution snapshot, gate evidence, and decision
  record hash. Forge now presents eight blank accept/reject decisions, rationales, three human
  attestations, and actor-specific append-only history; the server strips the entire proposal and
  history during an incomplete blind session. No decision or accepted artifact currently exists.
- 2026-08-29: Hardened dispatch gates to v2. Every authorization now contains canonical hash
  bindings that preflight re-reads and verifies; legacy v1 gates can document blocked history but
  cannot authorize new work. The derived gate writer accepts only a fixed profile and prerequisite
  run ID, derives quality/human state from verified activation or passed-round evidence, and cannot
  accept operator-supplied booleans or evidence paths. No live gate was created.
- 2026-08-29: Added the final scale-recommendation v3 lifecycle. It requires eligible,
  stage-correct scheduler runs at effective levels 2, 4, 6, 8, and 12, plus either a completed
  Scale-16 run or an authorized capacity-blocked Scale preflight tied to Load-12. The chosen safe
  concurrency must be measured; 16 can be chosen only after a completed Scale run. Current evidence
  remains insufficient, so the check fails closed without writing.
- 2026-08-29: Added a read-only final-controlled activation-readiness contract and reporter. It binds any future resolution ledger to the canonical plan, current catalog and execution snapshot, all 21 eligible original-v1 blind reviews, the three immutable revise-result hashes, and all 16 plan-owned risks. Blocking corrections must be full manifests under the review-owned staging namespace and must differ canonically from the risky derived target. No resolution ledger or staged/live artifact has been created; the current report is intentionally unauthorized until genuine human blind review and risk resolution exist.
- 2026-08-29: Isolated Forge review rounds by exact target-ID registries. The baseline remains the default, while the final-controlled round is unavailable until all 24 plan-owned manifests exist and match their reserved coordinates. Review submissions, media access, counts, and gate projections are scoped to the selected round, preventing baseline and final candidates from being mixed.
- 2026-08-29: Added a checked-in, non-executable allocation for exact 2-, 4-, 6-, 8-, 12-, and 16-worker stages. Every stage owns exactly its requested number of collision-free target, assignment, candidate, and result paths; the 16-worker stage contains two jobs for each of the eight species and evenly distributed affinities. Dispatch still requires hash-bound gate evidence and exact provisioned capacity. Current eligible measured levels remain 2 and 3, so no higher concurrency claim or scale endpoint is recorded.
- 2026-08-29: Closed the final-controlled manifest activation lifecycle without activating it. The guarded writer recomputes authorization before and under an exclusive lock, overlays the human-approved staged corrections, regenerates all 24 assignments, rejects any of the 96 reserved-path collisions, and publishes a hash-bound 48-manifest receipt last. Failure injection proves transaction-owned rollback and receipt-bound idempotence. Completion and Forge now reject receipt-less or drifted final-controlled manifests; the live workspace remains intentionally unactivated.
- 2026-08-29: Made baseline blind review reviewer-scoped and resumable. A reviewer identity is normalized once and bound server-side, progress counts only that reviewer's current-hash records, reviewed cells are marked, and the next unreviewed candidate opens after a save. A zero-write readiness command verifies the exact 21-candidate/3-revise baseline inventory and prints the reviewer-specific export, sync, and activation handoff commands.
- 2026-08-29: Repaired and operationalized concurrency-sentinel preparation for the future Load-12
  and Scale-16 jobs. Readiness now depends on the passed final-controlled round, DB-authenticated
  accepted rules, current installed skill, immutable allocation, source/reference hashes, and 56
  collision-free owned paths—not on the unfinished Breadth round that the sentinels are needed to
  complete. A guarded publisher rechecks readiness before and under an exclusive lock, creates 14
  targets and 14 assignments without overwrite, rolls back only transaction-owned files, and
  commits a 28-artifact hash-bound receipt last. Live publication remains correctly blocked before
  human review; no sentinel manifest was activated.
- 2026-08-29: Aligned production failure evidence across the shared TypeScript contract, generated
  JSON schemas, Python skill verifier, and operator instructions. New provider-failure attempts use
  one explicit kind (`capacity`, `provider-throttle`, `timeout`, `malformed-output`, `persistence`,
  or `other`); terminal failed results require it, non-provider outcomes forbid it, and immutable
  historical candidate/revise records remain readable.
- 2026-08-29: Re-ran the final skill through a fresh-agent Goblin Normal dry run after making
  `dryRun` an explicit pre-generation stopping branch and correcting the skill-relative result
  verifier path. The v4 receipt reproduces validation, two purpose-bound reference inspections,
  canonical prompt bytes without submission, and zero output writes. Skill-tree digests now exclude
  generated Python cache files so validation cannot make its own evidence stale.
- 2026-08-29: Repaired the later-pack rule-history query for Zod 4 by validating its read scope
  with a dedicated unrefined contract. A focused query-entry regression now prevents the prior
  runtime `.pick()` failure. The available local database was subsequently migrated through `0017`
  and can persist or list both human decision types.
- 2026-08-29: Added the append-only foundation for the 16 final-controlled design-risk decisions.
  The strict contract fixes every risk ID, coordinate, source target, severity, evidence binding,
  rationale, and attestation in plan order; blocking risks cannot be retained. Migration `0016`
  and an advisory-lock-serialized database API provide server timestamps, exact idempotency, and a
  linear latest decision per actor without creating a decision or activating a manifest. Migration
  `0017` normalizes two PostgreSQL index names that would otherwise exceed its identifier limit.
- 2026-08-29: Added a read-only affinity-review database doctor. It checks connectivity, the full
  migration ledger through `0017`, and the exact review/decision tables, columns, and indexes in a
  PostgreSQL read-only transaction. After the separately invoked additive migrations, the live
  probe reports `ready` with all 17 migrations and no missing schema objects; the doctor itself
  neither applies migrations nor exposes connection credentials.
- 2026-08-29: Added a DB-authentic, zero-write readiness boundary for the final-controlled design-
  risk review. It requires the immutable 24-result baseline, exact `21 candidate / 3 revise`
  inventory, current plan and catalog hashes, all 21 latest blind records for one explicit reviewer,
  and a checked-in blind-review export that is canonically identical to that database projection.
  Stale, wrong-reviewer, API-unverified, and revise substitutions fail closed; database errors are
  redacted. The live report remains correctly blocked at zero reviews.
- 2026-08-29: Added the strict v2 resolution-ledger contract for the later exporter and activation
  verifier. It embeds the exact append-only database decision and its canonical hash, binds all 16
  ordered resolutions to plan identities and source evidence, permits staging only for human-
  selected replacements, and confines each stage to its coordinate-owned collision-safe path. No
  ledger or staged target was created. The optional normalized `AFFINITY_REVIEW_ACTOR`
  configuration value is reserved for a server-owned local operator identity; it is not presented
  as general-purpose authentication.
- 2026-08-29: Connected the final-controlled design-risk gate to Forge and a dev-gated API. The
  server derives the actor from `AFFINITY_REVIEW_ACTOR`, recomputes readiness and all five evidence
  hashes on every submission, accepts only the 16 blank-by-default choices plus five attestations,
  and returns `409` with refreshed state when evidence or history changes. Actor, decision ID,
  supersession, and evidence bindings are never client authorities. Blind-mode page data withholds
  this surface, and the client bundle receives risk identities only as server data in label-visible
  mode. The UI resets all drafts after a stale response or changed fingerprint.
- 2026-08-29: Added the guarded DB-to-ledger v2 exporter. It selects the actor's latest
  unsuperseded decision, recomputes the exact `21 / 3 / 16` evidence sets and all five hashes,
  verifies every requested replacement against an already-existing coordinate-owned staged target,
  and exclusively creates the ledger only in explicit write mode. Check mode and incomplete live
  evidence remain zero-write; the current zero-review workspace produces no ledger.
- 2026-08-29: Upgraded final-controlled activation to reject legacy v1 ledgers and require the v2
  export. Both readiness checks around the guarded writer re-read the decision database and require
  the ledger to embed the actor's exact latest unsuperseded row, then independently verify its
  canonical hash, all five current evidence bindings, the exact `21 / 3 / 16` sets, and every
  staged target. Database failures are sanitized blockers. Adversarial tests prove that v1,
  forged, stale, superseded, and database-unavailable evidence writes no activation artifact.
- 2026-08-29: Bound completion to the same v2 evidence chain and added a Forge end-to-end privacy
  check. Completion now rejects missing configured actors, non-latest database decisions, stale or
  forged ledgers, invalid staged replacements, and activation receipts that do not name the exact
  ledger hash. The label-visible Forge route renders 16 blank decision rows and five blank
  attestations, while the blind route withholds risk identifiers, coordinates, scope, and history
  from rendered HTML. The contracts package is explicitly side-effect-free so unused server-only
  risk schemas are tree-shaken; a production bundle audit confirms that the protected risk IDs,
  coordinates, and scope identifier are absent from all client chunks. Public base target IDs
  remain ordinary catalog data and are intentionally not misclassified as secret decision metadata.

The plan is now backed by a runnable implementation rather than being a design-only document:

- the reusable, locally installed `summonlab-image-production` skill is versioned under
  `skills/summonlab-image-production/` and passes the skill-package validator;
- a fresh bounded subagent completed a no-image Goblin preflight from only the installed skill,
  immutable target, and dedicated `dryRun: true` envelope; its prompt, reference, ownership,
  installed-skill-tree, and zero-output evidence is hash-bound and reproducible under `dry-runs/`;
- strict target, assignment, attempt, result, catalog, blind-review, evaluation, and dedicated
  affinity-review contracts are implemented and covered by tests;
- 48 base manifests plus six Elemental semantic-regression and six final correction-regression
  manifests are exported with 120 unique owned output paths;
- deterministic export, validation, exact-source persistence, result verification, aggregate sync,
  review-evidence export, deterministic blind contact-sheet export, and goblin-independence audit
  tooling is implemented;
- a guarded preparer deterministically builds all 24 final-protocol targets and assignments in an
  isolated preview, validates all 24 through the installed skill, and refuses live activation while
  any audited blocking design risk remains pending;
- an exact-concurrency scheduler now covers the 2-, 4-, 6-, 8-, 12-, and 16-worker stages with
  collision preflight, append-only claims, bounded dispatch, capacity/throttle stop rules, and
  evidence-derived reporting; it never silently records a lower-capacity run as the requested stage;
- a completion checker derives nine plan sections from live manifests, results, image hashes, blind
  reviews, Forge projections, concurrency reports, and accepted decision artifacts; it exits
  nonzero until the full experiment is genuinely complete;
- the Forge affinity-workflow page presents all 60 targets across 14 collision-free rows, supports
  label-visible inspection and a controlled-only server-stripped blind workflow, verifies candidate
  bytes before serving them, and records append-only hash-bound reviews with server-derived mode
  provenance and no promotion;
- the Death Knight six-affinity pilot, the first Gray Wolf canaries, and the neutral-chassis
  Elemental regression have produced measured, hash-bound evidence;
- all 24 controlled results, six Elemental regression results, and six final correction results are
  complete: 30 producer candidates and six bounded `revise` outcomes, all unapproved;
- the 24 controlled outputs are assembled into a reproducible `1920×1080` opaque contact sheet;
  its exact bytes are checked in the repository validation pipeline;
- the controlled matrix has only 10 first-attempt candidates against the 20-target threshold, and
  no blind human recognition evidence has been recorded. At the product owner's direction,
  experimental Breadth production proceeded without weakening the separate human acceptance and
  promotion gates; all 24 Breadth images are now complete and unapproved;
- the integrated Breadth matrix contains 15 producer candidates and nine bounded `revise` outcomes,
  with all 24 retained images and result records present in the Forge catalog and contact sheet.

The machine-derived gate-readiness report proves that the current controlled cohort cannot become
passing through review alone: only 21 images are producer candidates, only 17 reviewable non-Normal
targets can receive acceptance, and the immutable first-attempt count is 10. The experiment therefore
requires a coherent versioned 24-coordinate final-protocol controlled rerun before breadth can open;
the gate is not weakened or reinterpreted around the existing evidence.

The exact 24-coordinate final controlled rerun is preplanned in
`review/final-controlled-rerun-plan.json`. It reserves collision-free v3/v4 namespaces and balances
all four species across eight three-worker fallback waves for the active four-slot task. The guarded
preparer has proven 24 valid targets, 24 valid assignments, 24 distinct canonical prompts, and 53
purpose-routed references in temporary storage without creating any live manifest, result, or image.
The source audit records eight blocking design risks and eight nonblocking risks. The blockers are
the five non-Metal Death Knights, whose command and materially integrated affinity cues need
plan-owned overrides, plus Normal, Wood, and Wind Cave Bears, whose four-readable-paw stance needs a
stronger or replacement source. Activation remains false until the informative v1 human review is
recorded and every blocking risk is resolved.

The active Codex task exposes four total agent slots. Reserving one slot for orchestration yields a
measured ceiling of three concurrent image jobs. Local configuration now requests 17 total task
threads—one orchestrator plus 16 image workers—but that change applies only to a newly started task
and remains merely a ceiling until observed. This
is now preserved as an exact Pilot preflight: four workers requested, four total slots observed,
three workers admitted, zero output collisions, and zero jobs dispatched. It is an
environment-capacity finding, not proof that 4-, 8-, 12-, or 16-job execution works. Those ladder
stages require a newly provisioned task that actually exposes the requested slots; the manifests,
ownership boundaries, stop rules, and instrumentation are prepared for that continuation.

Current generation timing shows why parallelism matters. Built-in image calls are commonly around
20–48 seconds, while a complete auditable job—including task startup, reference inspection, one
possible correction, exact persistence, structured result writing, and verification—has commonly
taken roughly 110–214 seconds. Runtime drawing of already-authored modular assets can still be
real-time; model generation of a novel finished portrait should be treated as asynchronous
production or background enrichment rather than a frame-time operation.

The final correction regression exercised the reusable skill with prior candidates as narrowly
routed design references. Fire Gray Wolf v2, Wood Cave Bear v2, Fire Elemental v3, and Metal Death
Knight v3 are verified producer candidates. Metal Death Knight v2 remains immutable framing
evidence superseded by v3. Wind Cave Bear v2 remains `revise` after both attempts again occluded the
far hind paw; the repeated target-specific failure is recorded without weakening the four-paw gate
or starting an unbounded retry loop.

## Operator handoff sequence

The implemented workflow is intentionally resumable. These commands inspect or advance one
evidence boundary at a time; substitute an explicit reviewer or actor identity and round where
shown:

Candidate production is no longer blocked on baseline review. Run ready assignments first in
bounded parallel waves, verify and catalog the resulting candidates, and then use the human-review
commands below to accept or revise them. The current task exposes three image-worker slots, so its
production cadence is three jobs per wave. A future task exposing the configured 17-thread ceiling
may run one orchestrator plus as many as 16 image workers, but only after the measured concurrency
ladder confirms that provider capacity, persistence, and quality remain acceptable.

Completed production order:

1. **Wave 1:** generated Goblin Normal, Tunnel Boar Fire, and Cave Drake Normal.
2. **Waves 2–8:** consumed the remaining 21 Breadth assignments in balanced rolling three-worker
   batches, preserving species and affinity coverage rather than finishing one family at a time.
3. **After every wave:** independently verified results and retained images; after the final wave,
   synchronized all 60 live executions and integrated the exact 24-target `breadth-v1` round.
4. **Current boundary:** the generated Breadth set awaits human blind review; no candidate is
   approved or promoted.
5. **Conditional continuation:** the 4 → 8 → 12 → 16 measured concurrency ladder remains future
   evidence work and must use new collision-free sentinel coordinates rather than relabeling this
   three-worker production run.

```bash
# Human baseline review after candidate production (requires an accessible PostgreSQL database
# with current migrations).
pnpm doctor:affinity-review-db
pnpm db:migrate
pnpm doctor:affinity-review-db
AFFINITY_REVIEW_ACTOR=<reviewer> pnpm dev:app
# Open /forge/enemies/affinity-workflow?mode=blind&scope=controlled&round=baseline-v1&reviewer=<reviewer>

# Baseline human review readiness and guarded final activation.
pnpm report:baseline-blind-review -- --reviewer <reviewer>
pnpm export:affinity-review-evidence --reviewer <reviewer>
pnpm sync:affinity-review
pnpm report:final-controlled-design-risk-readiness -- --reviewer <reviewer>
# Reload the label-visible Forge page, complete all 16 decisions, then stage only
# human-selected replacements.
pnpm export:final-controlled-design-risk-resolutions -- --actor <same-reviewer>
pnpm report:affinity-final-controlled-activation
pnpm activate:affinity-final-controlled-rerun -- --acknowledge-live-manifest-activation

# One exact post-generation round: final-controlled-v1 or breadth-v1.
pnpm sync:affinity-review-round -- --round <round>
pnpm export:affinity-round-review-evidence -- --round <round> --reviewer <reviewer>
pnpm export:affinity-round-contact-sheet -- --round <round>
pnpm finalize:affinity-round-evaluation -- --round <round> --acknowledge-human-review

# Human rule acceptance after the final round passes.
pnpm report:later-pack-visual-rules
pnpm export:accepted-later-pack-visual-rules -- --actor <actor>

# Read-only derivation check for the 14 future Load/Scale sentinels.
pnpm report:affinity-concurrency-sentinel-readiness -- --actor <actor>

# Deterministic workload allocation plus a zero-write Breadth generation preflight.
pnpm check:affinity-wave-allocation-v2
pnpm check:affinity-breadth-generation-readiness

# Only after the report is ready: publish the exact 28 manifests and receipt.
pnpm activate:affinity-concurrency-sentinels -- \
  --actor <same-actor> \
  --acknowledge-live-sentinel-activation

# Derived promotion gate and measured concurrency recommendation.
pnpm write:affinity-dispatch-gate -- --profile <normal|final|breadth|load> [...]
pnpm check:affinity-scale-recommendation
pnpm finalize:affinity-scale-recommendation -- \
  --acknowledge-human-decision \
  --recommended <2|4|6|8|12|16> \
  --production-strategy "<measured production policy>" \
  --fallback-behavior "<capacity or quality fallback>"
SUMMONLAB_LATER_PACK_RULE_ACTOR=<same-actor> pnpm check:affinity-plan-completion
```

The sync, review-export, contact-sheet, finalization, rule, gate, scale, and completion tools all
fail closed when their prerequisite is missing or stale. Their check modes do not manufacture
results, reviews, approvals, gates, or performance evidence. Once a rule-acceptance artifact
exists, the completion check also requires the accepting actor explicitly and verifies that
actor's latest append-only database decision; an unavailable database or superseded decision is
not accepted as historical proof.

## Objective

Build and validate a reusable `summonlab-image-production` skill that can:

- receive one structured visual target and an explicit output assignment;
- inspect purpose-specific references without treating them as instructions;
- generate one independently owned image;
- inspect anatomy, canvas completion, framing, identity, and target fidelity;
- retry under a bounded policy;
- record exact prompt, timing, source, dimensions, hash, and review state;
- operate safely across many parallel agents without shared-file collisions;
- preserve a species while expressing a materially meaningful elemental affinity;
- support controlled single-axis tests and more difficult compound-variation tests;
- produce review candidates without promoting its own work into an approved catalog.

The initial work must answer five questions:

1. Does a concise reusable workflow produce complete, auditable assets when an agent receives only
   the workflow, one target, and an execution envelope?
2. Can the generator preserve species identity across Normal, Wood, Fire, Metal, Water, and Wind?
3. Does each affinity change construction, silhouette, motion, anatomy, equipment, or counterplay
   rather than merely changing color?
4. Does the same affinity adapt appropriately to armored undead, substance-bodied elementals,
   organic beasts, humanoid enemies, and unusual reptilian anatomy?
5. How do reliability, candidate quality, and wall-clock throughput change at 2, 4, 8, 12, and
   eventually 16 parallel image jobs?

## Product and execution decisions

- One target produces one image. Comparison plates are assembled deterministically from individual
  outputs after generation; they are not generated as multi-subject images.
- The agent that creates an image owns only its assigned target, output image, and result record.
  It never edits a shared catalog, review index, aggregate metric, or comparison sheet.
- A parent/orchestrator validates manifests, assigns collision-free paths, integrates completed
  results, builds review sheets, runs aggregate validation, and makes commits.
- Every generation is a candidate. The generating agent can reject or request revision, but cannot
  approve or promote its own result.
- The default retry allowance is one corrective retry per target. A second failure is recorded as
  `revise` rather than inviting an unbounded loop.
- Human design-risk review chooses a direction after the informative baseline evidence and before
  producer-authored replacement targets. The decision alone cannot stage targets or activate
  manifests; replacement targets are subsequently hash-verified, and the generated final images
  still require their own blind review. A second human approval of the exact staged prompt is not
  required.
- Affinity, monster grade, level, battlefield duty, and random physical attributes remain separate
  axes. They may be combined only in a test that explicitly declares compound variation.
- The controlled affinity matrix holds presentation at Grade 4 / Elite. Grades 7–10 are a later
  stress test so that scale and magical escalation do not hide weak affinity design.
- Pack 2 remains medieval. The workflow itself is not medieval-only and must accept a pack-specific
  style contract so later packs can use different coherent genres.
- No paid or externally mutating generation route is enabled merely by this plan. Any such route
  requires its own explicit authorization and cost boundary.

## Workload matrix

### Controlled matrix: 24 targets

The first matrix isolates affinity as much as practical across four construction modes:

| Species | Construction mode | Normal | Wood | Fire | Metal | Water | Wind |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Death Knight | Undead body, armor, weapon, and binding | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Elemental | Body made from the affinity substance | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Gray Wolf | Organic quadruped with integrated affinity | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Cave Bear | Heavy organic quadruped with integrated affinity | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Core total: **24 unique targets**, excluding corrective retries.

The unaffiliated elemental is a neutral tower elemental made from rough stone, dust, and pale arcane
binding energy. It acts as the Normal baseline rather than borrowing one of the five affinity
languages.

### Breadth matrix: 24 additional targets

After the controlled matrix passes its visual and workflow gates, extend the same six affinity
states to four previously established Summonlab enemies:

| Species | Why it is useful | Normal | Wood | Fire | Metal | Water | Wind |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Goblin | Humanoid face, body, clothing, equipment, and duty variation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tunnel Boar | Compact charging quadruped with tusks and armored shoulders | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Cave Drake | Wingless draconic anatomy, digging forequarters, and breath cues | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tower Basilisk | Low six-legged reptile with gaze organs and a readable blind flank | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Breadth total: **24 additional unique targets**. The complete planned ceiling is therefore **48
unique images**, plus only the retries or final regressions justified by observed failures.

The breadth phase was originally release-gated. The product owner subsequently authorized
generation-first experimental production while preserving review gates for acceptance and
promotion. All 24 Breadth coordinates have now been generated and integrated.

## Shared visual controls

The controlled targets use:

- Grade 4 / Elite combat intensity;
- the Pack 2 realistic dark-fantasy material and lighting contract;
- one subject, head to toe or entire creature, with all extremities visible;
- consistent camera distance, neutral cracked-stone floor, and charcoal-to-midnight backdrop;
- a `1536×1024` landscape canvas unless the pilot proves a portrait canvas is more reliable for
  individual full-body anchors;
- at least eight percent safe margin around the complete silhouette;
- restrained local emission rather than a colored full-body glow;
- no labels, text, UI, frames, logos, watermarks, extra creatures, or published-character
  resemblance.

The image must contain finished detail across the entire canvas. Blank bands, unpainted regions,
abrupt cutoffs, and cropped limb tips are failures, reflecting the earlier arachnid generation
failure rather than acceptable negative space.

## Species invariants

### Death Knight

Every variant retains:

- an undead armored commander identity;
- a skull or death mask;
- a small command pennant;
- a deliberate sword guard;
- a command seal beneath the gorget;
- disciplined military posture and believable armor load paths.

Affinity may alter the armor construction, weapon behavior, binding medium, local aura, exposed
weak point, and environmental wake. A Metal Death Knight must be more specific than an ordinary
knight wearing ordinary metal armor.

### Elemental

Every variant retains:

- a readable combat body and locomotion;
- a concentrated core or binding structure;
- anatomy constructed from the selected substance;
- a silhouette that communicates its attack pattern and exposed counterplay.

Affinity is the body itself for an elemental, not an exterior particle overlay.

### Gray Wolf

Every variant retains recognizable canine anatomy, four-legged predatory locomotion, wolf facial
structure, and a fast flanking silhouette. It must not acquire humanoid armor, antlers, wings, or
dragon anatomy merely to make the affinity visible.

### Cave Bear

Every variant retains recognizable ursine anatomy, heavy shoulder mass, powerful forelimbs,
four-legged weight distribution, and a close-range bruiser silhouette. It must remain distinct from
a large wolf or a humanoid golem.

### Tunnel Boar

Every variant retains a low charging body, thick neck, load-bearing shoulders, cloven feet, tusks,
and an armored line-breaking duty. Affinity must not obscure the head-down charge line or turn the
boar into a generic horned beast.

### Cave Drake

Every variant remains a wingless low quadrupedal dragon with digging shoulders, large foreclaws,
battering skull, tail balance, and a readable throat vulnerability. It must not acquire wyvern
wings or lose credible draconic joints.

### Tower Basilisk

Every variant remains a low heavy reptile with six grounded legs, a rigid group of forward-facing
gaze organs, one controlled attack lane, and a vulnerable blind flank. Affinity cannot turn the
basilisk into a snake, ordinary lizard, or many-eyed amorphous mass.

## Goblin compound-variation grammar

Goblins deliberately test whether the workflow can combine affinity with individual variation.
Each goblin target draws or specifies independent attributes for:

- battlefield duty: skirmisher, archer, hexweaver, chieftain, guard, or scout;
- stature within goblin range: short, average, or tall;
- build: wiry, lean, sturdy, or broad;
- adult age and visible wear;
- face shape, nose, jaw, brow, ear shape, scars, and asymmetry;
- skin palette and localized markings;
- clothing layers, material condition, footwear, headwear, and armor coverage;
- handedness, weapon or focus, posture, and equipment anchors;
- affinity expression and counterplay cue.

Affinity, duty, body, face, and clothing are seeded independently. Compatibility rules may reject
an impossible equipment combination, but must not encode fixed stereotypes such as every Fire
goblin being a mage, every Metal goblin being broad, or every Wind goblin being an archer.

For the first six-image goblin cohort, manifests intentionally cover all six affinities, at least
four duties, all four builds, visibly different faces, and six clothing silhouettes. Because this
is a compound test, its results are evaluated for both manifest fidelity and affinity recognition;
they are not used to infer that affinity alone caused every visual difference.

Before larger random generation, run 60- and 600-manifest audits without creating images. Reject
accidental correlations between affinity and duty, stature, build, skin, facial construction,
clothing quality, or battlefield importance.

## Affinity grammar

Every affinity must alter at least two meaningful dimensions among material, silhouette, motion,
anatomy, equipment, attack telegraph, environmental wake, and exposed counterplay. Color alone does
not count.

| Affinity | Required construction language | Common failure to reject |
| --- | --- | --- |
| Normal | Established species materials and restrained neutral effects | Accidental elemental glow or unexplained magical anatomy |
| Wood | Bark grain, roots, vines, resin, wooden articulation, or living growth | Brown recolor, decorative antlers, or foliage pasted over the body |
| Fire | Heat-blackened surfaces, ember seams, combustion, smoke, and heat distortion | Uniform orange glow that destroys material and anatomy detail |
| Metal | Forged anatomy, articulated plates, metallic marrow, or controlled fragments | Ordinary armor presented as an affinity |
| Water | Flow, pressure, mist, wet reflection, and readable fluid transitions | Shapeless blue blob or generic blue glow |
| Wind | Directional fur or cloth, vapor channels, debris flow, and pressure distortion | Pale recolor, transparency alone, or effects with no directional force |

Application differs by construction mode:

- Death Knights express affinity through undead binding, armor, weapons, and command effects.
- Elementals express affinity as substance-bodied anatomy.
- Beasts express affinity through organic integration, breath, movement, localized anatomy, and
  environmental response.
- Goblins express affinity through physiology, equipment, clothing, tools, and combat telegraphs
  while preserving individual identity.
- Draconic and reptilian creatures integrate affinity into scales, throat or gaze organs, locomotion,
  and signature attacks without abandoning their established anatomy.

## Reusable skill package

Keep the skill entrypoint concise and move conditional detail into supporting references:

```text
skills/summonlab-image-production/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── references/
│   ├── target-schema.md
│   ├── result-schema.md
│   ├── species-grammar.md
│   ├── affinity-grammar.md
│   └── review-rubric.md
└── scripts/
    ├── validate-target
    └── verify-result
```

The repository copy is canonical and versioned. Installation or a link beneath
`/home/joao/.codex/skills/` makes it discoverable to local Codex tasks. The implementation must
validate the installed form rather than assuming discovery succeeded.

`SKILL.md` contains only the reusable workflow:

1. Validate the assignment and target.
2. Read only the references required by that target.
3. Inspect each visual reference for its declared purpose.
4. Construct and preserve the exact generation prompt.
5. Generate exactly one candidate.
6. Inspect anatomy, full-canvas completion, framing, identity, affinity, and prohibited traits.
7. Perform at most one corrective retry when the failure is correctable.
8. Save only inside the assigned output boundary.
9. Write a structured result and provenance record.
10. Leave approval, shared-catalog integration, and commit ownership to the orchestrator.

## Agent input contract

An image-producing agent receives three small inputs:

1. **Workflow:** invoke `summonlab-image-production`.
2. **Target:** a versioned target manifest describing the desired asset.
3. **Execution envelope:** assignment ID, permitted outputs, forbidden shared files, retry ceiling,
   and completion contract.

The target manifest includes:

- asset, pack, experiment, species, affinity, grade, and battlefield-duty IDs;
- identity and anatomy invariants;
- physical or compound variation attributes when applicable;
- permitted transformations and prohibited traits;
- reference paths with an explicit purpose for each reference;
- style, medium, background, lighting, composition, and canvas requirements;
- objective and human-review acceptance tests;
- owned candidate and result paths.

The result record includes:

- target, assignment, skill-version, and attempt IDs;
- status: `candidate`, `revise`, or `failed`;
- exact prompt and referenced-input hashes;
- request start, generation completion, inspection completion, and total wall time;
- source-output identifier;
- output dimensions, file size, media type, and SHA-256;
- self-inspection observations and failed criteria;
- retry reason and relationship to the preceding attempt;
- output paths and confirmation that no shared file was edited.

## Output layout

The implementation should use a collision-resistant experimental layout such as:

```text
assets/enemies/experiments/affinity-workflow-v1/
├── targets/
├── candidates/
│   ├── death-knight/
│   ├── elemental/
│   ├── gray-wolf/
│   ├── cave-bear/
│   ├── goblin/
│   ├── tunnel-boar/
│   ├── cave-drake/
│   └── tower-basilisk/
├── results/
├── review/
│   ├── contact-sheet.png
│   ├── blind-review.json
│   └── evaluation.json
└── generation-record.md
```

Targets and per-job results may be written independently. The orchestrator creates the contact
sheet, aggregate evaluation, generation record, and any Forge catalog only after all jobs in a wave
have stopped.

## Implementation and test sequence

### Phase 1 — Build the workflow

- Create the skill and its focused references.
- Define versioned target, assignment, and result schemas.
- Add deterministic target and result validators.
- Create the first 24 controlled manifests before image generation.
- Validate unique IDs, normalized paths, references, and ownership boundaries.
- Run a dry execution that stops before image generation.
- Validate the skill package with the skill validator.

Exit gate: a fresh agent can read only the skill, one target, and one execution envelope and produce
the expected dry-run result without additional coaching.

Execution status: passed with the Goblin Normal `dryRun: true` envelope and hash-bound no-output
record under `assets/enemies/experiments/affinity-workflow-v1/dry-runs/`.

### Phase 2 — Death Knight pilot

Use the strongest existing identity grammar to expose workflow and palette-swap failures early:

1. Run Normal and Fire as two parallel canaries.
2. Inspect workflow adherence, image completion, identity, affinity, and provenance.
3. Correct only generalized workflow, species, or affinity problems.
4. Run Wood, Metal, Water, and Wind as four parallel jobs.
5. Perform a blinded affinity and Death Knight identity review.

Successful canaries count toward the 24-image matrix.

### Phase 3 — Balanced six-job matrix

Generate the remaining Elemental, Gray Wolf, and Cave Bear targets in three balanced waves:

| Wave | Elemental | Gray Wolf | Cave Bear |
| --- | --- | --- | --- |
| A | Normal, Wood | Fire, Metal | Water, Wind |
| B | Fire, Metal | Water, Wind | Normal, Wood |
| C | Water, Wind | Normal, Wood | Fire, Metal |

Each wave contains every affinity once and two targets from every species. This separates species
difficulty from wave timing and backend conditions.

Exit gate: controlled-matrix workflow, fidelity, recognition, and provenance thresholds pass before
compound variation or higher concurrency begins.

### Phase 4 — Goblin and breadth manifests

- Generate and validate the 60- and 600-goblin manifest audits without image calls.
- Author the 24 breadth targets for Goblin, Tunnel Boar, Cave Drake, and Tower Basilisk.
- Verify that goblin duty, build, face, clothing, and affinity coverage are independent and coherent.
- Run one Goblin and one Tunnel Boar as targeted breadth canaries.
- Revise only rules supported by repeated or structurally explained failures.

Execution status: complete for image production. The deterministic 60- and 600-manifest audits
pass, all 24 Breadth manifests have verified retained outputs/results, and the integrated round
contains 15 candidates plus nine bounded revisions. Human recognition and acceptance remain
pending.

### Phase 5 — Concurrency ladder

Increase parallelism only after the preceding stage passes:

The executable schedule uses named workloads rather than selecting by stage alone. This matters
because Canary and Controlled each occur more than once:

| Workload ID | Jobs | Target family | Required predecessor |
| --- | ---: | --- | --- |
| `final-canary` | 2 | Death Knight Normal and Fire | Human-approved final-manifest activation |
| `final-pilot` | 4 | Remaining Death Knight affinities | Final Canary pass |
| `final-controlled-a` | 6 | Balanced Elemental, Gray Wolf, Cave Bear wave A | Final Pilot pass |
| `final-controlled-b` | 6 | Balanced Elemental, Gray Wolf, Cave Bear wave B | Controlled A pass |
| `final-controlled-c` | 6 | Balanced Elemental, Gray Wolf, Cave Bear wave C | Controlled B pass |
| `breadth-canary` | 2 | Goblin Normal and Tunnel Boar Fire | Passed final human review |
| `breadth` | 8 | Goblin, Tunnel Boar, Cave Drake, Tower Basilisk | Breadth Canary pass |
| `load` | 12 | Remaining Breadth jobs plus six activated sentinels | Breadth-8 pass |
| `scale` | 16 | Mixed eight-species wave plus eight activated sentinels | Load-12 pass and capacity preflight |

Together, Breadth Canary, Breadth-8, Load-12, and Scale-16 cover all 24 Breadth coordinates exactly
once. Goblins vary manifest-owned duty, build, face, clothing, equipment, and affinity; the other
families vary species grammar and elemental construction without requiring the same humanoid
attribute matrix.

The generation-first product run completed those 24 coordinates in rolling three-worker waves
outside the formal promotion-gated scheduler. It proves image completion, ownership, and
provenance, but it is not mislabeled as 8-, 12-, or 16-worker performance evidence. Future measured
Load/Scale runs require their separately activated collision-free sentinels.

| Stage | Parallel image jobs | Purpose | Promotion gate |
| --- | ---: | --- | --- |
| Canary | 2 | Verify tool invocation, ownership, saving, and result contract | Zero collisions and complete retained-output provenance |
| Pilot | 4 | Exercise Death Knight affinities after canary correction | No workflow failures |
| Controlled | 6 | Balanced species/affinity comparison | Visual and workflow thresholds pass |
| Breadth | 8 | Add goblin attributes and unusual anatomy | No quality or retry-rate regression |
| Load | 12 | Measure queueing, throughput, and integration behavior | Stable completion and no throttling cascade |
| Scale | 16 | Prove the planned maximum concurrent workload | Explicit capacity preflight and all earlier gates pass |

The 16-job wave should mix species and affinities rather than assign one family to the entire wave.
A representative schedule contains two targets from each of the eight species and distributes the
six affinity labels as evenly as possible. This prevents one unusually difficult species from being
mistaken for a concurrency failure.

Before the scale wave:

- verify the effective Codex agent limit in the running task rather than trusting configuration
  alone;
- configure a project ceiling of 17 total task threads—one orchestrator plus 16 image workers—if
  supported by the current environment;
- restart or begin a new task if configuration changes require it;
- verify image-tool and backend concurrency separately from agent concurrency;
- reserve the orchestrator for validation and integration rather than assigning it an image target;
- prepare all paths and manifests before starting any child job;
- define a stop condition for widespread timeout, throttle, or malformed-output failures.

A project configuration may request the intended ceiling:

```toml
[agents]
enabled = true
max_concurrent_threads_per_session = 17
```

That setting is only a ceiling. The active Codex task, account, image backend, or application build
may expose a lower effective limit. A 17-thread configuration therefore does not by itself prove
16 simultaneous image generations; the orchestrator must remain outside the image-worker count.

Required stop conditions for the 12- and 16-job stages:

- stop launching new work if three jobs in the same wave receive any combination of throttle,
  capacity, timeout, or malformed-output failures;
- allow already-running jobs to finish and retain their evidence;
- do not retry capacity failures inside every child agent simultaneously;
- reduce concurrency one step and repeat only the affected targets;
- classify capacity reduction as a scheduler finding, not a visual-skill failure.

Execution status: [the scheduler](affinity-wave-scheduler.md) implements the full staged protocol.
The current-task Pilot evidence at
`assets/enemies/experiments/affinity-workflow-v1/wave-runs/pilot-current-task-capacity-v1/preflight.json`
records requested concurrency 4, admitted image-worker capacity 3, no collisions, and a mandatory
pre-dispatch stop. No image, event journal, or performance metric was fabricated for the blocked
wave. The 16-job plan validator additionally requires exactly two jobs from every one of the eight
species and affinity counts that differ by at most one.

### Phase 6 — Final-skill regression

If the skill or its references change materially during testing, regenerate four to eight sentinel
targets with the final skill version. The sentinel set includes every construction mode and the
most common earlier failure. Recommended coverage:

- Normal and Water Death Knights;
- Metal Elemental;
- Wind Gray Wolf;
- Fire Cave Bear;
- one compound Goblin;
- one Cave Drake or Tower Basilisk;
- the species-affinity pair with the lowest review score.

Execution status: the six-target correction regression is complete across armored undead,
substance-bodied Elementals, and organic quadrupeds. It verified the final prompt/provenance path
and the most common framing, construction, and anatomy failures. The completed Breadth matrix now
adds compound Goblin, draconic, and six-legged coverage. Conditional Load/Scale sentinels remain
future work and are not silently waived or producer-self-approved.

### Phase 7 — Forge review surface

Add an experimental affinity-workflow route with:

- species rows and Normal/Wood/Fire/Metal/Water/Wind columns;
- controlled and breadth cohort filters;
- labeled and label-hidden blind-review modes;
- normal-versus-affinity comparison;
- full-size candidate inspection;
- manifest, exact prompt, attempt, timing, source, dimensions, and hash;
- candidate/revise decision recording;
- concurrency and retry metrics;
- no automatic promotion into Pack 2 or the runtime enemy catalog.

## Evaluation rubric

### Workflow success

- 100% of completed targets have complete retained-output provenance and valid hashes; rejected
  intermediate attempts retain prompts, provider identifiers, timings, and findings even when their
  image bytes are not persisted.
- Zero cross-agent output collisions or shared-file edits.
- Every result stays within its assigned output boundary.
- Every failed acceptance criterion is reported explicitly.
- Retry ceilings are respected.
- At least 80% of controlled targets become candidates on the first attempt.

### Visual success

- Species is recognized correctly in at least 23 of the 24 controlled images.
- Affinity is identified correctly in at least 20 of the 24 controlled images during blind review.
- All four controlled Normal variants read as unaffiliated.
- Every accepted affinity changes at least two meaningful visual dimensions.
- No accepted candidate contains cropped anatomy, unfinished canvas regions, catastrophic limb
  errors, or an unreadable silhouette.
- Death Knights preserve all required command cues across all affinities.
- Wolves, bears, boars, drakes, and basilisks remain unmistakably different species.
- Goblin targets preserve manifest-owned body, face, clothing, duty, equipment, and affinity cues
  without collapsing into one repeated goblin.

### Parallel performance

Record for every concurrency stage:

- generation, inspection, and end-to-end time per attempt;
- median, `p90`, `p95` where sample size is meaningful, and slowest completion;
- whole-wave wall-clock time;
- sum of individual job times;
- effective speedup and parallel efficiency;
- queue delay, timeout, throttle, malformed-output, and retry rates;
- candidate rate and visual score by concurrency stage;
- missing results, duplicate IDs, path conflicts, and integration errors.

Do not declare a faster stage successful if its visual candidate rate or provenance completeness
falls materially below the preceding stage.

At roughly one minute per image, 48 serial candidates would require roughly 48 minutes of raw model
time before inspection and retries. Sixteen-way execution could reduce raw generation to about three
waves under ideal capacity, but agent startup, image-backend queueing, inspection, saving, and
retries prevent assuming linear speedup. The benchmark replaces estimates with measured evidence.

## Blind and automated review

Automated validation checks:

- target and result schema validity;
- unique IDs and owned paths;
- file existence, media type, dimensions, size, and hash;
- complete timestamps and exact prompt retention;
- attempt linkage and retry ceiling;
- completed-canvas and safe-margin heuristics where reliable;
- absence of undeclared shared-file modifications.

Human blind review hides species and affinity labels, then asks the reviewer to identify both and
score:

- species identity;
- affinity readability;
- silhouette and battlefield duty;
- material credibility;
- anatomy and ground contact;
- affinity integration rather than palette swap;
- Pack 2 style cohesion;
- overall candidate/revise decision.

The producing agent's inspection is useful evidence but never substitutes for human approval.

## Failure classification and iteration rules

Correct failures at the narrowest durable layer:

| Failure | Correction location |
| --- | --- |
| Missing provenance, wrong path, unbounded retry | Skill or execution contract |
| Repeated loss of one species' identity | Species grammar |
| Repeated palette swaps across species | Affinity grammar |
| One malformed or anatomically broken image | Target-specific retry or generator variance |
| Repeated goblin attribute correlation | Manifest generator or compatibility rules |
| Duplicate IDs or overwritten assets | Orchestrator and path assignment |
| Timeouts or throttling under load | Scheduler and concurrency ceiling |
| Forge comparison or metadata error | Integration and review surface |

Do not add a universal skill rule for every isolated visual accident. Promote a correction into the
shared skill or reference only when the failure is structurally explained or repeats across
targets.

## Delivery checkpoints

### Checkpoint A — Workflow contract

Review the skill, schemas, dry-run handoff, owned-output policy, and retry boundary before making
image calls.

### Checkpoint B — Death Knight pilot

Review all six Death Knights. Confirm that they remain one species, all affinities are recognizable,
and Metal and Normal are clearly different.

### Checkpoint C — Controlled matrix

Review the 24-image blind contact sheet and measured six-job workloads. Decide whether the skill is
ready for compound goblin variation and higher concurrency.

### Checkpoint D — Breadth and goblins

Review the goblin manifest audits, six individual goblins, and the added beast/reptile families.
Decide whether body, face, clothing, duty, and affinity variation remain coherent.

### Checkpoint E — 16-job scale test

Compare 8-, 12-, and 16-job stages for speed, failures, retries, quality, and integration safety.
Select the highest concurrency that improves useful throughput without a material reliability or
quality regression.

## Final deliverables

- versioned, validated `summonlab-image-production` skill;
- target, assignment, and result schemas;
- deterministic validation and review-sheet helpers;
- 24 controlled target manifests and their bounded-attempt results;
- up to 24 gated breadth targets and their bounded-attempt results;
- 60- and 600-manifest goblin independence audits;
- exact prompts, sources, timing, dimensions, hashes, and review states;
- controlled and breadth contact sheets;
- blind-review results and failure classifications;
- concurrency report covering 2, 4, 6, 8, 12, and, when capacity permits, 16 jobs;
- recommended safe concurrency and fallback behavior;
- experimental Forge affinity-review route;
- accepted visual rules for later monster grades and future packs;
- a scale recommendation for producing hundreds of static candidates.

## Completion criteria

Run the evidence checker at every handoff:

```bash
pnpm check:affinity-plan-completion
```

It intentionally exits with status 1 while any of the nine evidence sections is incomplete. A
preparatory plan, a provisional recommendation, or producer self-review cannot satisfy a missing
result, human blind review, effective concurrency measurement, accepted later-pack rule, or final
scale recommendation.

The workflow experiment is complete when:

- a fresh agent can execute a target correctly from the skill, manifest, and envelope alone;
- the controlled 24-image matrix meets workflow and visual thresholds;
- generalized failures have been corrected and verified through final-skill sentinels;
- goblin attribute manifests demonstrate independence before large image batches;
- at least one unusual added anatomy class passes the workflow;
- the system has measured, rather than assumed, its useful concurrency ceiling;
- the 16-job test either passes or yields a recorded lower safe ceiling with evidence;
- every candidate remains hash-bound, reviewable, and unpromoted until human acceptance;
- the Forge exposes the complete evidence needed for a product and visual decision.
