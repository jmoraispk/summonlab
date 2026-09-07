# Foundation final-review fix A — fail-closed public boundaries

## Status

Review round 1 implemented. Internal proof rows, authoritative engine events/state, replay reducers,
and frozen v24 bytes/hashes are unchanged. The only persistence change is additive migration
`0019_private_capability_entropy.sql`.

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
`eventCursor`, `stateHash`, and `eventType`. Public rounds contain `initiativeOrder` plus actor
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
uses the non-invertible manifest hash as public binding evidence and omits recipe seed/cursors,
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
- Replay compatibility covers a real immutable v1 state plus frozen v5, v8, and v14-v24 vector final
  states. The engine suite's 317 tests, including frozen v24 vectors, passes unchanged.
- Database integration proves new entropy persists privately and legacy null-entropy v2 rows remain
  readable from their persisted profile.

## Historical disclosure note

Character-v2 recipes returned before this migration were already disclosed and cannot be made secret
retroactively. No destructive rewrite is attempted. Those persisted profiles remain authoritative;
all newly created public v2 runs receive independent private capability entropy.

## Verification evidence

- `pnpm --filter @summonlab/web test:unit` — 35 files, 175/175 passed.
- `pnpm --filter @summonlab/web typecheck` — 0 errors, 0 warnings.
- `pnpm --filter @summonlab/web lint` — passed.
- `pnpm --filter @summonlab/web build` — production build passed; only existing optional sharp
  platform warnings were emitted.
- `pnpm --filter @summonlab/engine test` — 29 files, 317/317 passed, including frozen replay vectors.
- `pnpm --filter @summonlab/contracts test -- capability.spec.ts` — 14 files, 119/119 passed.
- `pnpm --filter @summonlab/characters test` — 2 files, 19/19 passed.
- `pnpm --filter @summonlab/database test` — non-DB suite passed, DB suites skipped without env.
- With the local test database: migration applied and `src/proof.integration.spec.ts` passed 5/5.
- `git diff --check` — passed.

No blocking design seam remains for this slice.
