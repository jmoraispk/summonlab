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
- Contract SHA-256: `2bd23b35550c3f039ad63d05854891c80e292a32c2ea71cf24eaf7cc4fababbf`
- Approved execution-surface SHA-256:
  `fa9da223ccf2836537b2766a68488ed2b1ca88b8ab4ec006aa5473c851b3cba9`

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

## Fix round 1 — anchored outputs and mandatory dispatch

Independent review found three important gaps. All three are now closed without generating pixels
or changing the legacy v1/v2 workflow.

1. Family candidate and result persistence now fail closed on non-Linux systems or unavailable
   `/proc/self/fd`, traverse through held `O_DIRECTORY | O_NOFOLLOW` handles, rebind device/inode
   identity before final creation, create the final file with `O_CREAT | O_EXCL | O_NOFOLLOW`, and
   clean up relative to the held parent inode. The family workflow uses the new candidate persister
   and anchored result writer exclusively. Six deterministic parent-rename/symlink swap probes
   leave external sentinels byte-identical and create no external output; collisions, symlinked
   provider sources, and leaked handles are rejected.
2. The approval receipt binds an exact 13-file v3 execution surface: contract, skill instructions,
   family references, validator, renderer, verifier, candidate persister, and result writer. A
   length-prefixed framed digest and per-file hashes bind both the tracked and installed skill roots.
   The installed resolved root must exactly equal the approved worktree skill root. Contract,
   documentation, validator, renderer, verifier, writer, persister, bundle, or root drift fails.
3. `pnpm check:family-affinity-production-dispatch -- TARGET ASSIGNMENT [ROOT]` is the mandatory
   production boundary. It validates the receipt, installed bundle, active manifest paths and
   hashes, packet, exact no-newline prompt bytes, output absence/symlink containment, and complete
   Normal approval evidence. The Python family validator invokes this gate before structural
   validation. Planned elementals require strict candidate/result bytes, ordinary controller
   assignment/attestation and receipt; T3/T5 additionally require a separate agreeing blind
   assignment/receipt with independent identities. Seven-field pseudo-review plus
   `{"normal":"result"}`, missing/tampered evidence, and foreign identities/paths/hashes all fail.

Fix-round validation:

- Skill quick validation: pass
- Python family profile: 13/13 pass, including six swap subtests and symlinked-source rejection
- Family production/review/compatibility/dispatch: 211/211 pass
- Production determinism: 1,501 artifacts verified
- Review determinism: 61 artifacts, 30 sheets, 750/750 `NOT GENERATED`, digest
  `2d9fb17773390efcd70da3a7034d4ce267d58cdcbac7cf18eabb6ac363437bca`
- Full repository tests: 721 pass; 24 expected database-dependent skips
- Full repository typecheck: pass; Svelte reports 0 errors and 0 warnings
- No image-generation call, candidate, result, review, catalog, manifest, wiki, or runtime write
