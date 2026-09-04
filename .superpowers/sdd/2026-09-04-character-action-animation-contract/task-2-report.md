# Task 2 — Versioned Locomotion-Support Evidence

## Changed files

- `tools/validate-realtime-combat-motion-pack.mjs`
- `tools/validate-realtime-combat-motion-pack.spec.mjs`

No `iron-guardian-motion-support-v4.json` was created. The interface is optional, and real v4
evidence remains owned by Task 3 after its generated cells and hashes exist.

## RED

Command:

```sh
node --test tools/validate-realtime-combat-motion-pack.spec.mjs
```

Output before implementation: 4 tests ran; 2 passed and 2 failed. The failures were the invalid
support sequence and repeated-hash cases, each observing exit status `0`, proving that the
validator ignored `--advance-support-evidence`.

## GREEN

Command:

```sh
node --test tools/validate-realtime-combat-motion-pack.spec.mjs
```

Output after implementation: 7 tests passed, 0 failed. The suite exercises the executable
validator with a temporary evidence file and verifies rejection for an invalid support sequence,
repeated hashes, wrong authority, malformed hashes, and non-candidate status; it also verifies a
valid five-cell candidate succeeds.

Additional checks:

```sh
pnpm exec prettier --check tools/validate-realtime-combat-motion-pack.mjs tools/validate-realtime-combat-motion-pack.spec.mjs
git diff --check
node tools/validate-realtime-combat-motion-pack.mjs apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-manifest-v3.json
```

All completed successfully. The existing manifest-only invocation emitted `{"valid":true,"actorId":"iron-guardian","frames":20,...}`.

## Self-review

- The evidence path is optional, preserving existing atlas, anchor, clip, and ground-artifact
  validation behavior.
- A supplied evidence document must use `classical-human-run-5`, exactly
  `left,left,none,right,right`, exactly five distinct lowercase 64-character SHA-256 strings, and
  `candidate` status.
- Tests do not inspect source text or mock validation: each spawns the real validator with a
  temporary JSON artifact.

## Concerns

The validator verifies the evidence contract's structure and values; it intentionally does not
create or promote real v4 evidence. Task 3 must provide evidence derived from generated cells and
their hashes.
