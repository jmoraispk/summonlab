# Final Review Fix Report — Exploration Combat Contract

## Scope and result

This fix wave closes the five Important final-review findings and corrects the stale Task 4 replay
summary. It deliberately excludes production encounter creation, durable storage, Tower/mission
migration, exploration mutation, and UI redesign.

## 1. Trusted production content, art, and byte integrity

### Design

- createCombatContentCatalog() is an application-owned bootstrap API. It parses, clones, and deeply
  freezes catalog entries before a session may use them.
- resolveTrustedProductionContent() treats the request only as a lookup candidate. It compares hero
  identity/manifest hash; raster key/source/hash/approval; motion ID/source/version/hash/atlas
  source/hash/approval; enemy definition/presentation; and battlefield definition/environment/
  ordered occluders against the catalog.
- The default catalog is empty, so production fails closed until the application supplies approved
  catalog content. The test-only rat catalog comes from the static canonical fixture, never from
  the request under test. Fixture art remains limited to the exact canonical fixtureRequestHash.
- createVerifiedStageAssetLoader() verifies fetched raw bytes before Pixi receives a Blob URL. It
  covers rasters, motion JSON, and atlas images, uses Web Crypto where available, and otherwise uses
  the browser-safe engine SHA-256 implementation (not Node crypto).

### RED evidence

1. The initial catalog behavior test failed because ./combat-content-catalog did not exist.
2. The byte-integrity test initially failed to resolve ./stage-asset-integrity.
3. The malformed-catalog regression failed before runtime parsing was added:

   ~~~text
   expected [Function] to not throw an error but
   TypeError: Cannot read properties of null (reading 'find') was thrown
   ~~~

   pnpm --filter @summonlab/web test:unit -- combat-session.spec.ts reported 1 failed / 245
   passed tests across 37 files.
4. The no-Web-Crypto fallback initially failed with Web Crypto SHA-256 is unavailable.

### GREEN evidence

- A catalog-matching production request reaches loading; the default/no-catalog path rejects it.
- A malicious Asha raster rebound to the battlefield PNG rejects before loading. Coverage also
  rejects forged manifest, raster, motion, atlas, enemy, and battlefield bindings.
- Matching bytes load; mismatched bytes and network failures reject locally. The focused integrity
  run passed 245/245 web tests across 37 files before the final malformed-catalog addition.
- Fresh-preview Playwright passed the hash-mismatch route case and verified unavailable/no receipt.

## 2. Deterministic, trusted claim policy

### Design

The session parses the policy and its trusted binding at construction, recomputes the canonical
value-body hash (excluding contentId, version, and contentHash), requires the trusted triple to
agree exactly, then clones and deeply freezes both. Terminal claims use only that snapshot.

### RED evidence

The mid-session mutation regression changed caller-owned practice quantity from 4 to 68; before
the snapshot fix it changed claims and the output hash. A forged policy with a stale or self-rehashed
value also reached loading before trusted-binding comparison was introduced.

### GREEN evidence

The same run now has byte-identical events, claims, receipt, trace hash, and output hash whether or
not the original dependency object is mutated after construction. Stale/self-rehashed policy values
reject as stale-content-binding.

## 3. Receipt claim authorization and evidence semantics

### Design

Every claim definition reference must match a declared claim-policy binding exactly. Every source
event is semantic evidence: practice is action-resolved by the claimed hero with the claimed action;
material is unit-defeated targeting the claimed terminally defeated enemy; progression is the
terminal encounter-ended event. Strict false ownership flags remain unchanged.

### RED evidence

The new contract regression initially accepted an unbound-claim, wrong action actor/action, wrong
material event/target, and nonterminal progression sources. A follow-up regression accepted material
for an enemy not terminally defeated.

### GREEN evidence

pnpm --filter @summonlab/contracts test -- exploration-combat.spec.ts passed 14 files / 127 tests
after both validator passes. The valid fixture includes action, defeat, and terminal evidence.

## 4. Decisive cause in the output hash

### Design

outputStateHash now includes the complete decisiveCause object together with outcome, terminal
resources, defeated enemy IDs, and claims. Replay already compares output hash, so it naturally
detects decisive-cause tampering.

### RED evidence

Changing only decisive-cause summary/supporting event IDs produced a new expected hash while the old
implementation returned the unchanged hash.

### GREEN evidence

The regression passed with 36 web files / 239 tests: decisive cause is hashed, and a coherent tamper
fails replay verification.

## 5. Rejected-load/reclaim owner race

### Design

The shared stage owner keys verified assets by source + SHA-256. When a released pending claim is
reclaimed and its original loader rejects, the replacement starts a fresh load rather than resolving
the caught undefined. Final release retains correct reference counting/unload behavior, and
rejections are observed internally.

### RED evidence

Both deferred-loader regressions failed before the fix with Expected: 2, Received: 1 for the
replacement load attempt.

### GREEN evidence

stage-lifecycle.spec.ts passed after the reload change (36 web files / 241 tests at that point),
covering reclaim-before-first-rejection, reclaim-after-rejection, fresh assets, deterministic
failure, reference counts, and final unloads.

## Task 4 correction

The Task 4 opening description now says replay reruns fresh unified mechanics and independently
regenerates a candidate trace/receipt. It no longer says replay advances stored trace events.

## Final verification

All commands used `PATH=/tmp/summonlab-node-24.14.1/bin:$PATH`.

| Command | Result |
| --- | --- |
| `pnpm --filter @summonlab/contracts test` | 14 files / 127 tests passed |
| `pnpm --filter @summonlab/contracts typecheck` | passed |
| `pnpm --filter @summonlab/web test:unit` | 37 files / 246 tests passed |
| `pnpm --filter @summonlab/web typecheck` | 0 errors, 0 warnings |
| `pnpm --filter @summonlab/web lint` | passed |
| `pnpm --filter @summonlab/web build` | passed in 8.90 s |
| targeted integrity/lifecycle/session/stage unit command | 37 files / 246 tests passed |
| fresh-preview route Playwright | 7 / 7 passed in 1.6 min |
| `git diff --check` | passed |

For the final route run, a fresh `ENABLE_DEV_ROUTES=true ENABLE_IMAGE_GENERATION=false pnpm build`
completed in 8.83 s, `pnpm preview --host 0.0.0.0 --port 4197` was confirmed listening on
`0.0.0.0:4197`, and Playwright reused that preview. The standard production build emitted existing
Vite node:crypto externalization and optional sharp-adapter warnings but exited successfully; the
new stage integrity path does not use Node runtime crypto.

## Self-review

- Trusted expectations originate only from the catalog snapshot; production request fields never
  establish the expected artwork data.
- Pixi decodes verified byte buffers through object URLs, never request asset URLs. Source/hash keys
  prevent cross-hash ownership aliasing.
- Policy and request data are immutable session snapshots; caller mutation cannot alter terminalization.
- Claim sources are checked semantically and against terminal enemy state. No committed or exploration
  mutation fields were added.
- The scope remains intentionally bounded to the lab encounter contract and stage lifecycle.

## Remaining limitation

There are no approved production rat-study motion packs/catalog entries in this repository. The
default production path therefore intentionally rejects until application-owned approved catalog
content is supplied. The exact canonical fixture is the only fixture-art exception.
