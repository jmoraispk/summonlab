# Foundation final-review fix A — fail-closed public boundaries

## Status

Review round 2 implemented. Internal proof rows, authoritative engine events/state, replay reducers,
and frozen v24 bytes/hashes are unchanged. Persistence changes are the additive private-entropy
column migration `0019_private_capability_entropy.sql` and its coordinated shape-constraint migration
`0020_private_capability_entropy_shape.sql`.

## Root causes

The original public routes serialized authoritative replay/event values directly. The first fix
replaced that with a recursive denylist, but review correctly rejected it: a future authoritative
field would remain public until somebody remembered to add its name to the denylist. Separately,
character-v2 capability and hidden learning scores were hashes of the player-visible recipe, so
redaction did not make the learning profile non-derivable.

## RED evidence

Tests now exercise real character-v2/v25 bootstrap, mission preparation, deployment, and one
automatic round. Unknown future-field sentinels are injected at state, hero, mission, round, action,
player-journal, event-payload, and proof roots. Before the final implementation they crossed the
generic projector or caused the old public proof shape to retain recipe/cognition fields.

Additional RED cases require:

- equal `(recipe, private capability entropy)` pairs to reproduce the same profile;
- changing only private entropy to preserve manifest identity while changing capabilities/learning;
- strict public proof records to reject internal snapshots and omit recipe, mind, learning, and raw
  proof-event payloads;
- production decision-context/decision-preview calls to return 404;
- mission mutations to return one exact minimal receipt;
- initiative presentation to retain order without total, base, or tie-break values.

## GREEN implementation

`apps/web/src/lib/server/public-engine-presentation.ts` now builds replay state, actors, equipment,
mission attempts, rounds, public outcomes, Master-owned control summaries, player journal records,
SSE events, and mutation receipts field-by-field. There is no recursive generic projector or
private-key denylist. Unknown fields are dropped because no constructor reads them. The public proof
contracts in `packages/contracts/src/proof.ts` are independent strict schemas rather than extensions
of the internal proof schema.

Public mission/control/decision-window mutation receipts contain exactly `runId`, `version`,
`eventCursor`, `publicStateHash`, and `eventType`. Public rounds contain `initiativeOrder` plus actor
identity, public intent, outcome, movement/effect outcome, and summary; they contain no initiative
number, initiative base, tie-break, packet hash, legal-action hash, policy-result hash, or private
legal-action collection. Master-owned current actions remain available only on mission SSR as a
bounded player affordance; hero action lists never cross the boundary.

`POST /api/runs` now generates 256 bits of capability entropy with the server cryptographic RNG.
Character-v2 generation derives capabilities/learning through SHA-256-labelled draws from this
private entropy. The same recipe and entropy replay deterministically, while a public recipe alone
cannot reproduce the result. The entropy is stored only in nullable private database column
`summonlab_proof_runs.capability_entropy`; proof, event, page, and API projections never include it.

Legacy v2 rows keep their already-persisted capability profile and may have null private entropy.
No replay-time regeneration or destructive data rewrite is required. `PublicProofRunSnapshotV2`
uses a hash of its explicit public manifest projection as public binding evidence and omits recipe seed/cursors,
private mind, directive, hidden learning, and raw proof-event payloads. GET, already-resolved decide,
arrive, summon SSR, play SSR, and mission SSR share this projector.

Decision-context and decision-preview packet inspectors now use the existing `ENABLE_DEV_ROUTES`
authority and return 404 in production. The summon SSR preview is likewise null in production.
Control and decision-window remain player features, but now return minimal receipts instead of raw
Master-control state. The replay development page is a read-only public audit surface; the raw
command experiment endpoint remains development-gated.

The play SSR boundary narrows legacy campaign context to its public objective projection instead of
serializing stored character drafts. Create-run failures also return a fixed public message rather
than reflecting database exception details, so private capability entropy cannot leak through an
error path.

## Security self-review

- Enforcement happens before JSON/SSE serialization, not through UI omission.
- SSE coverage reads the whole `after=0` stream through the real v25 round and checks every buffered
  frame for master seed, public recipe seed, hidden learning, and unknown sentinels.
- Initiative order remains visible, but neither operand nor the total needed to recover a tie-break
  draw is published.
- Public state retains visible combat attributes, actor identity/status, public telegraphs/outcomes,
  operator mode binding, versions, and hashes. Hero mind/social cognition, provider/model packets,
  private action sets, entropy, and hidden learning stay internal.
- Replay compatibility projects every schema version from v1 through v24 plus a real v25 state.
  The engine suite's 317 tests pass, including unchanged frozen v24 vectors.
- Database integration coverage proves new entropy persists privately and legacy null-entropy v2
  rows remain readable from their persisted profile; these tests require `TEST_DATABASE_URL`.

## Historical disclosure note

Character-v2 recipes returned before this migration were already disclosed and cannot be made secret
retroactively. No destructive rewrite is attempted. Those persisted profiles remain authoritative;
all newly created public v2 runs receive independent private capability entropy.

## Review round 2 — RED evidence

The second review exposed five remaining classes of boundary defect:

- v25 engine randomness still had a player-recipe fallback at the persistence seam;
- entropy accepted non-canonical strings and capability derivation was not bound to a versioned,
  canonical recipe key;
- public payloads reused internal state, event, proof, manifest, and reward-delta hashes/shapes;
- ordinary route failures could reflect a thrown private value;
- legacy campaign and onboarding routes still returned full character drafts, raw mind/personality,
  private hashes, and the campaign seed.

New tests first failed against those behaviors. They cover two real production create requests with
the same public recipe, exact lowercase 64-hex entropy validation, profile/recipe/entropy audit,
hidden-field hash invariance, nested unknown sentinels, production route error reflection, every
historical schema version 1–24 plus v25, and the campaign list/create/get/onboarding/restart and SSR
boundaries. The final campaign test was deliberately tightened to reject `campaignSeed` before that
field and its UI labels were removed.

## Review round 2 — GREEN implementation

The production v25 create path now generates exactly 32 random bytes and derives two separate,
domain-labelled SHA-256 values from the canonical recipe key plus that entropy: one for hidden
capability/learning generation and one for engine entropy. The database validates the entropy at
the API, derivation, and persistence seams and verifies the supplied v2 profile against the shared
canonical derivation owner before opening the transaction. The additive database constraint accepts
only null or lowercase 64-hex. The v2 generator and new v2 writes fail before connecting if entropy
is absent; legacy null rows remain readable without regeneration.

All player-facing evidence now hashes explicit public projections only. Public engine state,
events, replay checks, journal entries/reports, proof manifests/events, settlement views, equipment,
and campaign objectives have their own labelled projection hashes. Internal canonical hashes stay
inside storage/replay. Changing hidden learning or private event payload fields leaves both public
bytes and public hashes unchanged; changing a projected field changes the corresponding hash.
Equipment uses its own `equipment-workshop` hash domain rather than sharing settlement's domain.

The public character manifest and reward-delta shapes are independently constructed allowlists.
Mission, replay, SSE, proof, summon, play, campaign, onboarding, settlement, conversation, and
mutation boundaries do not inherit or spread internal records. Campaign surfaces retain public
identity, visible manifest traits, prose demeanor, public replies, and objective progress, while
omitting character drafts, recipes, campaign seeds, raw mind/personality scores, private manifests,
and internal hashes. Raw decision packet inspectors remain available only when
`ENABLE_DEV_ROUTES` authorizes development routes; production returns 404.
The first-band archive and synthesis SSR inspectors now use the same production gate as their APIs.

Expected public errors are fixed by error class/status, and unexpected exceptions are logged only
server-side. Sentinel exception text is absent from tested GET, decision, arrival, journal, mission,
control, decision-window, campaign, onboarding, conversation, projection, and equipment responses.

## Review round 2 — security self-review

- Projection constructors name every serialized nested field; there is no recursive omit helper,
  denylist copier, internal schema extension, or UI-only redaction.
- Public initiative evidence includes order and resolved outcomes, never initiative base, total, or
  tie-break values. The test cannot reconstruct the private draw from the public receipt.
- Public hash domains are labelled and contain only their explicit DTOs. Internal state/event/proof
  hashes are not exposed as unkeyed hidden-state oracles.
- The actual v25 POST path uses private engine entropy. Equal public recipes create different engine
  seeds and initiative streams, neither reproducible from the recipe.
- Fixed v25 test profiles now carry explicit fixture entropy. Their current v25 automatic-round
  expectation was refreshed; all frozen v1-v24 hashes and replay bytes remain unchanged.
- Existing public v2 recipe disclosures cannot be undone. This fix does not rewrite historical
  proof or engine bytes; it protects new runs and narrows all current public readers.
- Campaign generation remains a legacy v13 internal seam. It can consume its stored seed server-side,
  but the seed and full character draft no longer cross a production route or SSR boundary.

## Verification evidence

- `pnpm --filter @summonlab/web test` — 36 files passed, 1 skipped; 182/182 executed tests passed.
- `pnpm --filter @summonlab/web typecheck` — 0 errors, 0 warnings.
- `pnpm --filter @summonlab/web lint` — passed.
- `pnpm --filter @summonlab/web build` — production build passed; only existing optional sharp
  platform warnings were emitted.
- `pnpm --filter @summonlab/engine test` — 29 files, 317/317 passed, including frozen replay vectors.
- `pnpm --filter @summonlab/contracts test` — 14 files, 119/119 passed.
- `pnpm --filter @summonlab/characters test` — 2 files, 22/22 passed.
- `pnpm --filter @summonlab/database test` — 4 non-DB tests passed; 31 database-backed tests were
  skipped because `TEST_DATABASE_URL` is not configured in this worktree.
- Contracts, characters, database, engine, and web typechecks and lints — passed.
- `git diff --check` — passed.

No blocking design seam remains for this slice.
