# Task 7A — Semantic revision recovery, round 2

## Status

Task 7 v1 is not complete. Its packets, provider sources, rasters, receipts, and review evidence
remain immutable historical evidence. The first Task 7A v2 recovery is also retained byte-for-byte,
but its receipt timing cannot independently prove that all four core artifacts had been published:
it lacked a post-core completion audit. It is predecessor evidence only and is not selectable.

Round 2 adds the current authority without altering either historical scope:

- 24 immutable `prompts/revisions-v3/*-v3.json` packets in sorted path order;
- 21 deterministic V3 inset recoveries using the exact authenticated `1254 -> 696` Lanczos3
  placement at `(164,192)`;
- 3 V3 identity/adoption recoveries: Still Depths, Warmth, and Red Harvest;
- 24 V3 `candidate` provider/revision/composite/result sets, each with a separate completion audit;
- 4 pending V2 generation packets: Living Metal, Ore Sense, Taming, and Rend Armor;
- zero image-generation calls.

The semantic state is deliberately `24/28`, `candidateCount: 24`, and `ready: false`. No owner
review, selection, promotion, wiki replacement, or claim of completion was created.

## Recovery and audit authority

Packets/results now support arbitrary integer revisions `>=2`. Every packet has a matching versioned
schema/path and binds the exact immediate predecessor packet/result/provider/interior/composite and
transaction digest. The V3 inset lanes re-derive from their authenticated V2 provider with bounded
caBX removal, sRGB assignment, one Lanczos3 resize to `696×696`, transparent-canvas placement, and
the existing aperture/backing/frame compositor. The identity lanes use the explicit
`identity-adoption-v2` transform and retain their approved V2 interior/composite bytes.

Persistence stages and publishes the provider, revision interior, composite, and receipt as one
held-parent, create-only transaction. It re-reads every core output before writing a separate,
append-only completion audit. That audit records only truthful core-publication start/completion
times and the four core hashes; it intentionally makes no assertion about the completion time of its
own publication. A candidate is selectable only when this audit authenticates.

The finalizer independently parses and binds packet/result/audit, re-hashes the transaction content,
re-derives the provider/interior/composite/384px render, and verifies immediate-predecessor,
source/tool/geometry/backing/frame/findings/status bindings. It resolves only the highest declared
terminal revision; a newer missing, `revise`, or `failed` receipt blocks older-candidate fallback.

## Pending generation persistence

The four generation-v2 packets remain intentionally pending and no bitmap generation was invoked.
Their persistence lane is implemented and tested: it accepts only a safely read native `1254×1254`
RGB caBX provider, exact source SHA-256, actual attempt count, one identifier/hash per call, and
separate full-size/384px observations. The final call hash must equal the persisted provider hash.
It uses the same held-parent, create-only core transaction and the post-core audit protocol.

## Review evidence and visual inspection

The v2 evidence is preserved. Its file named `deterministic-v2-1024.png` actually contains 512px
cells and is explicitly legacy scaled evidence, not V3 original-size proof.

V3 evidence is append-only under
`assets/wiki/skills/icon-production-v1/quality-cleanup-v1/review/v3-recovery/`:

- `original-1024-v3-page-01.png` through `original-1024-v3-page-06.png`: 24 literal
  `1024×1024` composites, four cells on each `2048×2048` transparent page, with no resize or
  caption touching any cell;
- `display-384-v3-r2.png`: the 24 display-scale render sheet with compact two-line captions;
- `deterministic-v3-r2-report.json`: hash-bound page/display inventory and the explicit supersession
  note for the earlier V3 display sheet;
- `display-384-v3.png` and `deterministic-v3-report.json`: preserved initial V3 display evidence.

The six true-original pages and the r2 384px sheet were visually inspected. The deterministic inset
subjects and the three identity candidates remain inside the aperture, readable at display scale, and
free of the prior caption-overlap issue. This is technical candidate evidence only.

## Deliberate incomplete gate

`finalize:skill-icon-cleanup-v2` must continue to report 24 candidates and the exact four pending
generation targets. `check:skill-icon-cleanup-v2-complete` and the final semantic-review gate must
fail closed until those packets have authenticated candidate receipts and completion audits.

## Validation and immutability

The following gates passed after V3 materialization:

- focused contracts, generation persistence, and V3 recovery: 3 files / 10 tests;
- independent-authentication/finalizer suite: 1 file / 7 tests;
- `corepack pnpm typecheck:skill-icons`;
- V2 packet check: 28 existing packets and the exact four generation targets pending;
- V3 packet check: 24 existing packets;
- V3 recovery/finalizer check: 24 candidates, `ready: false`, and the exact four V2 revision-2
  receipts missing;
- `corepack pnpm test:skill-icons`: 21 files / 427 tests.

`check:skill-icon-cleanup-v2-complete` was also run and failed as required, reporting only Living
Metal, Ore Sense, Taming, and Rend Armor as missing revision-2 receipts.

The protected immutable aggregates were recomputed from sorted `sha256sum` records:

| Scope | Files | SHA-256 | Baseline match |
| --- | ---: | --- | --- |
| Mass production | 2,465 | `55133003f54d931442ff9acb653dda821d735674ab87873a581d8b030f475339` | yes |
| Cleanup base interiors/composites/results | 1,368 | `7483e18aeb37be211ae7174f4eef69e78d75732c554711567b04b467d97fe330` | yes |
| Shared targets/assignments/candidates/results | 210 | `d5582c4a721a8ed2a54f225d616a424d3127935d2f7dbd3967a6e8b272eba1f7` | yes |
| V1 semantic evidence | 140 | `e33e1d0896db97da18ae1a12c1ad53294cc7138058374d7871b5280c4dc1042e` | yes |
| V1 review evidence | 23 | `e398d4ee226ed2559960852b34cf65a21938c8d113aac04ee986b98ae3bba6a7` | yes |
| V2 recovery evidence | 127 | `7ed380d4cc73e3d014ce483d8d4d6e996154e1c1f8842eb14064cd8eacd39fb6` | yes |

The new V3 core authority contains 144 files with aggregate
`276b70d6732a4db96bfbb6d2d8b98562ad3618f42f992e860014d05e7d2f1151`; its ten review files have
aggregate `7976c428008f4eedb3e406f092c74e6429082aca37a2e2fe9a5afffc74d91d94`. `git diff --check`
also passes.

## Round 3 protocol hardening

The V1, V2, and V3 evidence bytes remain immutable. This round changes only the reusable
protocol and its regression coverage; it performs no image-generation call and materializes no
new raster or receipt.

- After the completion audit is create-only published, persistence now reauthenticates all four
  core artifacts and the audit through their canonical named paths. Each check verifies the held
  parent identity, a regular owned inode, and exact bytes using non-following/nonblocking reads.
  A post-audit foreign composite replacement therefore fails closed, preserves that unowned
  replacement, removes the transaction-owned audit during safe rollback, and never returns a
  candidate.
- `identity-adoption-vN` transforms now require their interior and composite path/hash bindings to
  equal the immediate predecessor receipt exactly. The contract, derivation, persistence, and
  finalizer all reject a cross-target same-rank substitution.

Round-3 validation passed:

- focused contract, persistence, V3 recovery, and finalizer tests: 22 tests across 4 files;
- `corepack pnpm typecheck:skill-icons`;
- V2 packet check: 28 existing packets with exactly Living Metal, Ore Sense, Taming, and Rend
  Armor still pending generation;
- V3 packet check: 24 existing deterministic packets;
- V3 recovery/finalizer check: 24 audited candidates, `ready: false`, and the same four missing
  V2 generation receipts.

The immutable aggregates reproduce unchanged: mass
`55133003f54d931442ff9acb653dda821d735674ab87873a581d8b030f475339`; cleanup base
`7483e18aeb37be211ae7174f4eef69e78d75732c554711567b04b467d97fe330`; shared
`d5582c4a721a8ed2a54f225d616a424d3127935d2f7dbd3967a6e8b272eba1f7`; V1 semantic
`e33e1d0896db97da18ae1a12c1ad53294cc7138058374d7871b5280c4dc1042e`; V1 review
`e398d4ee226ed2559960852b34cf65a21938c8d113aac04ee986b98ae3bba6a7`; V2 recovery
`7ed380d4cc73e3d014ce483d8d4d6e996154e1c1f8842eb14064cd8eacd39fb6`; V3 core
`276b70d6732a4db96bfbb6d2d8b98562ad3618f42f992e860014d05e7d2f1151`; and V3 review
`7976c428008f4eedb3e406f092c74e6429082aca37a2e2fe9a5afffc74d91d94`.

Task 7 remains deliberately incomplete at 24/28. No owner acceptance, promotion, selection, or
wiki replacement is inferred.
