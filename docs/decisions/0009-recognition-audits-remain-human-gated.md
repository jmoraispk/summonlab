# ADR 0009: Recognition audits remain human-gated

Status: accepted on 2026-08-24.

> **Historical implementation:** ADR 0065 retires the procedural renderer and interactive route
> used by this audit. The principle that recognition review remains human-gated is still accepted.

## Context

The visual catalog records cue scores for source images, but those scores do not prove that a runtime
rig remains the same person across camera distance, expression, equipment, motion, palette, and
injury. Automated image similarity would also be a poor approval authority: it can reward pixel
closeness while missing a generic face, broken anatomy, incorrect handedness, or an injury that
redesigns the person.

Phone delivery has a separate evidence gap. Encoded bytes alone do not show whether a derivative has
enough source pixels for its intended CSS size and device pixel ratio, while decoded texture bytes
are only one component of renderer memory.

## Decision

- `visual-recognition-audit-v1` binds one audit to the exact visual catalog hash, character manifest
  hash, approved source asset hash, and content-addressed runtime textures.
- Seven fixed cases cover every expression in Mara Vey's approved profile, all five camera tiers,
  base/night/injured palettes, no equipment, bow, practice blade, gait, and localized injury.
- Each case declares cues a human must check. Summon, dialogue, and roster require all five cues.
  Settlement and mission require four non-facial cues; settlement facial identity is forbidden as a
  schema invariant rather than quietly treated as a failure.
- The audit records `pending-human-review`. Passing schema validation, browser tests, or performance
  targets can never change that verdict or approve an asset.
- The mid-range phone profile is fixed at 390×844 CSS pixels and 2× device density. For every runtime
  derivative, the audit recomputes required pixels, density margin, encoded bytes, and decoded RGBA
  bytes from the checked-in runtime manifest. Totals and budgets are schema invariants.
- Decoded RGBA is labeled a texture-only proxy against the 300 MB renderer-memory reference. It is
  not presented as full renderer, GPU, browser, or device memory.
- `/visual-lab/recognition` renders every case with the deterministic code-native rig at actual CSS
  scale. It also reports a live requestAnimationFrame sample and case-switch-to-paint latency. Those
  observations describe the current browser and are not canonical evidence.
- Playwright exercises the route at the exact phone viewport and 2× density, rejects document-level
  horizontal overflow, requires the four-cue settlement contract, and checks the 30 fps and 150 ms
  targets. Real-device review remains a milestone gate.
- Build measurement now combines the static application shell with only the selected route's own
  static and dynamic import graph. It does not follow SvelteKit's app-level dynamic route table and
  count unrelated pages. Pixi's lazy renderer remains included in the runtime-inspector total.

## Consequences

The current audit covers seven controlled cases, five expressions, and five camera tiers without
claiming that a machine recognized the person. The three approved textures total 47,758 encoded bytes
and 5,505,024 decoded RGBA bytes. At the audited 2× display sizes, their density margins are 2.00×,
1.60×, and 1.33×. The route-specific production measurements are about 37.0 KB for the initial shell,
296.3 KB for the fully loaded Pixi inspector, and 44.5 KB for the recognition audit, all gzip and
below the 700 KB ceiling.

Mara still needs a human verdict across the seven cases. Remy remains outside this runtime audit
until his anchor is explicitly approved; the instrument does not use candidate pixels to manufacture
coverage.
