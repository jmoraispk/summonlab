# Task 7B — bounded generation-v2 evidence

## Status

Task 7 remains incomplete. The four assigned generation-v2 packets were processed in sorted path order, with exactly one built-in initial call and one bounded correction each. Three authenticated candidates were added; Taming is an honest terminal `revise` because its correction retained a source-intrinsic cropped forearm. No third call, fallback, owner action, selection, promotion, wiki replacement, or review-package rewrite occurred.

| Target | Terminal status | Calls (initial / correction) | 1024 / 384 |
| --- | --- | --- | --- |
| `craft:forging:living-metal` | candidate | `exec-ceefc90d-65aa-4c9a-b9bc-d9cd02aba141` / `exec-60935503-3c1a-4582-a767-7c0bda1cd5c2` | pass / pass |
| `craft:forging:ore-sense` | candidate | `exec-decc6b6f-813a-42e4-a244-6a767d3bcfdf` / `exec-d5b9325c-7c89-42c9-81bc-19467fa97c07` | pass / pass |
| `craft:gathering:taming` | revise | `exec-46c20faf-c579-4ff8-a914-00a55da3f89b` / `exec-a20897ae-2b74-4579-bb7b-a9b89425dc5f` | fail / fail |
| `martial:polearm:rend-armor` | candidate | `exec-03bc1bc2-a6ee-4600-8a8b-26f99c49488c` / `exec-bab71130-1686-49eb-b27b-892d9e37b811` | pass / pass |

## Receipt evidence

Every provider is a native `1254×1254` RGB PNG accepted by the strict caBX envelope check. Each result records exact call hashes, source/interior/composite/384 hashes, timings, findings, and transaction data; the separate completion audit binds all four core artifacts after create-only publication. Matching files use `<slug>-v2` under `provider-sources/`, `revisions/`, `composites/`, `results/revisions/`, and `results/completion-audits/` inside `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/`.

| Target | Call-content hashes | Final provider hash | Result time / audit time (UTC) |
| --- | --- | --- | --- |
| Living Metal | `fbab5ade4b0dc42911d11778e2ce12c3891796d74aec17c89194dbb49390ef78`, `ed96812101246b09d4aeb7b1f0011ebba80b2f02effd24b263b879aeb9a220dd` | `ed96812101246b09d4aeb7b1f0011ebba80b2f02effd24b263b879aeb9a220dd` | `12:33:29.403Z`–`12:33:31.588Z` / `12:33:31.650Z`–`12:33:31.704Z` |
| Ore Sense | `8b6b9745fdc9b7cbbc7bc58f8cc8b4393ade48fc51c991c4e795fd925f66a4a2`, `a6292d553d39de67c7a65ce5d6a3d19294743abfa206ea5a664f9b8ddb66329d` | `a6292d553d39de67c7a65ce5d6a3d19294743abfa206ea5a664f9b8ddb66329d` | `12:37:17.484Z`–`12:37:19.811Z` / `12:37:19.900Z`–`12:37:19.943Z` |
| Taming | `5c7467eb9dfec732d3057f532a2a93dbfb10d2caa614b09481dac5926ee3053f`, `3d7be588e8dd691025c127851e96ae0f948878a3102e2285e2f4c38fa991de0c` | `3d7be588e8dd691025c127851e96ae0f948878a3102e2285e2f4c38fa991de0c` | `12:41:25.525Z`–`12:41:27.752Z` / `12:41:27.822Z`–`12:41:27.870Z` |
| Rend Armor | `d452a08b084163c22a50618498a9fd61ebc1915c80ed44c04691698455a65907`, `111df61b487bfb2283e1938ff96cc097e3907c11855ada881dafc6a1d0cba81b` | `111df61b487bfb2283e1938ff96cc097e3907c11855ada881dafc6a1d0cba81b` | `12:45:47.869Z`–`12:45:50.168Z` / `12:45:50.255Z`–`12:45:50.296Z` |

Living Metal retains a complete hammer, anvil, and living-metal motif without an upgrade arrow. Ore Sense retains the complete gloved hand/cuff/fingertips and raw ore without an eye badge. Rend Armor retains the full halberd and armored target without chevrons. Taming removes its copied frame and medallion, but its offered human forearm still enters from the left source edge; that is the sole fail finding at both scales.

## Independent finalization

`corepack pnpm finalize:skill-icon-cleanup-v2` independently re-authenticated the selected evidence and reported `ready: false`, `candidateCount: 27`, with only `{ targetId: "craft:gathering:taming", revision: 2, status: "revise" }` unresolved. The 28/28 prerequisite is false, so the semantic review renderer was deliberately not run. The live-state integration expectation now requires the three selected V2 candidates and Taming as the sole higher-revision `revise`, preserving strict no-fallback behavior.

## Validation and immutable-input audit

- `corepack pnpm check:skill-icon-cleanup-v2-packets` passed.
- `corepack pnpm check:skill-icon-cleanup-v2` passed with 27 candidates and Taming `revise`.
- `corepack pnpm finalize:skill-icon-cleanup-v2` passed with the state above.
- `corepack pnpm check:skill-icon-cleanup-v2-complete` failed closed as expected: only Taming revision 2 is unresolved.
- `corepack pnpm vitest run tools/skill-icon-quality-cleanup-v2-lib.spec.ts` passed: 8 tests.
- `corepack pnpm typecheck:skill-icons` passed.

| Protected scope | Files | SHA-256 |
| --- | ---: | --- |
| Mass production | 2,465 | `55133003f54d931442ff9acb653dda821d735674ab87873a581d8b030f475339` |
| Cleanup base | 1,368 | `7483e18aeb37be211ae7174f4eef69e78d75732c554711567b04b467d97fe330` |
| Shared inputs/results | 210 | `d5582c4a721a8ed2a54f225d616a424d3127935d2f7dbd3967a6e8b272eba1f7` |
| V1 semantic evidence | 140 | `e33e1d0896db97da18ae1a12c1ad53294cc7138058374d7871b5280c4dc1042e` |
| V1 review evidence | 23 | `e398d4ee226ed2559960852b34cf65a21938c8d113aac04ee986b98ae3bba6a7` |
| Pre-existing V2 recovery | 127 | `7ed380d4cc73e3d014ce483d8d4d6e996154e1c1f8842eb14064cd8eacd39fb6` |
| V3 core authority | 144 | `276b70d6732a4db96bfbb6d2d8b98562ad3618f42f992e860014d05e7d2f1151` |
| V3 review evidence | 10 | `7976c428008f4eedb3e406f092c74e6429082aca37a2e2fe9a5afffc74d91d94` |

## Next authority required

An explicit append-only higher revision packet is required for `craft:gathering:taming`. It must provide a complete offered arm/hand and beast bond inside the safe area, with a fresh bounded call allowance; it cannot amend this revision-2 evidence.
