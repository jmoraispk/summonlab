# Family affinity production compatibility

Task 9 authorizes pixel dispatch only through the approved `summonlab-image-production-v3`
contract. It does not generate, approve, promote, or catalog an image.

## Approved contract

- Skill version: `summonlab-image-production-v3`
- Skill-side profile: `image-production-family-target-v1`
- Repository target schema: `family-affinity-target-v1` (unchanged)
- Assignment/result schemas: `family-affinity-assignment-v1` / `family-affinity-result-v1`
- Prompt material: `family-affinity-prompt-material-v1`, exact compact stable JSON bytes without a
  terminal newline
- Affinities, in order: Normal, Fire, Earth, Wind, Water
- Namespaces: canonical and bridge
- Approval: `user-confirmed-summonlab-image-production-v3-2026-09-02`
- Contract SHA-256: `80264409523e26a12f3427a969767340393a298a434031f5f7022c5e006deffe`

The family profile requires exact versioned paths, target/assignment cross-hashes, the current
canonical family-packet hash, raw candidate and prompt hashes, exclusive candidate creation, and an
immutable single-create compact result. Producer writes to review, catalog, contact-sheet, wiki,
runtime, or manifest files remain forbidden. A bridge Earth candidate remains provisional and can
never be producer-approved.

Legacy `image-production-target-v1` and `image-production-target-v2` dispatch remains available
without translation. Wood and Metal are supported only in that legacy mode.

## Installed development deployment

- Previous symlink target:
  `/home/joao/Documents/summonlab/skills/summonlab-image-production`
- Current symlink target:
  `/home/joao/.codex/worktrees/547e/summonlab/skills/summonlab-image-production`

Only `/home/joao/.codex/skills/summonlab-image-production` was repointed. The previous link was held
as an exact temporary backup until the new target and contract hash passed, then the backup was
removed. No main-checkout skill file was edited.

## Dry probes

- Current canonical Normal preflight: dispatchable, candidate-only ceiling.
- Current canonical Earth preflight: rejected as `blocked-on-anchor`.
- Synthetic bridge Earth preflight: dispatchable as `earth-bridge-provisional`, candidate-only
  ceiling.
- Installed renderer SHA-256 for the representative Normal prompt:
  `66d5022e0f6f899ca10ceb7482d3593658f204a2edcae7da5575d6a6ede4264a`, exactly matching the
  repository prompt-material hash.

No image-generation tool was called and no candidate or result was written by these probes.

## Validation

- Skill package validation: pass
- Python skill tests: 13/13 pass
- Family production/review/compatibility tests: 198/198 pass
- Production determinism: 1,501 artifacts verified
- Review determinism: 61 artifacts, 30 contact sheets, 750/750 not generated, digest unchanged
- Full repository tests: 708 pass; 24 expected database-dependent skips
- Full repository typecheck: pass; Svelte reports 0 errors and 0 warnings
- Targeted formatting and diff checks: pass
