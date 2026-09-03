# Near-3D Real-Time 2.5D Combat Study Implementation Plan

Design: [2026-09-03-realtime-2-5d-combat-study-design.md](../specs/2026-09-03-realtime-2-5d-combat-study-design.md)

## Outcome

Deliver an isolated `/living-village-lab/realtime-combat` prototype in which three original
Summonlab heroes fight a rat pack autonomously. The same deterministic encounter can be replayed in
an honest flat `2D` presentation and an aspirational near-3D `2.5D` presentation.

## Visual plan

- **Subject:** a Summonlab party holding a ruined village threshold at dusk.
- **Audience:** the owner evaluating whether 2.5D creates enough dimensionality and character appeal
  to justify its art cost.
- **Single job:** make the 2D-versus-2.5D rendering decision observable through one identical battle.
- **Palette:** Night Well `#05090e`, Fog Slate `#182934`, Saffron `#d89b42`, Linen `#eadcbc`, Wound
  `#a4473f`, Stable Cyan `#79c3cf`.
- **Type:** Georgia for the encounter title, the existing sans-serif stack for controls, and the
  existing monospace stack for inspectable agent state.
- **Layout:** a dominant 9:16 battlefield with controls inside its safe edges; desktop adds the agent
  sidecar to the right, while phone collapses it below a disclosure.
- **Signature:** one `2D / 2.5D` switch restarts the exact same seeded encounter while visibly
  engaging perspective scale, parallax, occlusion, shadow deformation, and atmospheric depth.
- **Restraint:** the battlefield, character motion, and impacts carry the experience. Outside the
  comparison switch and agent disclosure, interface chrome stays quiet.

```text
desktop                                  phone
┌────────────────────┬──────────────┐    ┌──────────────┐
│  2D | 2.5D  pause  │ agent intent │    │ mode  pause  │
│                    │ legal moves  │    │              │
│   dominant 9:16    │ cooldowns    │    │ dominant     │
│   battle stage     │ event trail  │    │ 9:16 stage   │
│                    │              │    │              │
│  status      replay│              │    │ status/replay│
└────────────────────┴──────────────┘    ├──────────────┤
                                         │ agent details│
                                         └──────────────┘
```

The direction is intentionally specific to Summonlab: saffron agency light visibly bends fog and
contact shadows in 2.5D mode. The comparison is a product instrument, not generic segmented-control
decoration.

## Work sequence

### 1. Preserve source and production metadata

- Add the owner-created hero source to an isolated, versioned combat-study source directory.
- Record provenance, source hash, permitted derivative use, identity invariants, and generated-asset
  prompts.
- Keep the supplied *Last Asylum: Plague* clips outside Git.

### 2. Pass the lead-hero art gate

- Generate one transparent adult-chibi combat anchor from the owned hero.
- Inspect the result at source and final gameplay scale.
- Reject identity drift, mirrored asymmetry, childish proportions, unstable costume construction,
  or poor transparency.
- Produce only the minimum action poses needed for idle, approach, strike, hit, and down.

### 3. Build the deterministic continuous simulation test-first

- Add focused simulation types and fixtures under the real-time combat component directory.
- Test fixed-step determinism, target commitment, range hysteresis, cooldown use, damage, defeat, and
  stable terminal outcome.
- Expose current public intent, legal actions, target, cooldowns, and resolved events without hidden
  reasoning.

### 4. Build the PixiJS near-3D stage

- Initialize one resize-bound PixiJS v8 application and one ticker.
- Add environment, ground-effect, Y-sorted actor, airborne-effect, foreground, atmosphere, and
  transient-UI layers.
- Bind bottom-center feet anchors, stable health bars, depth-dependent scale, parallax, foreground
  occlusion, responsive shadows, fog, particles, hit-stop, recoil, and bounded camera impulse.
- Destroy scene children before unloading the study bundle and destroy the application on route
  teardown.

### 5. Add the matched comparison mode

- Keep simulation, seed, actors, timing, framing, and effect vocabulary identical.
- In `2D`, flatten depth scale, parallax, occlusion, directional shadows, and atmospheric separation.
- In `2.5D`, enable the full dimensional treatment.
- Restart from the same seed when the mode changes and label the current mode accessibly.

### 6. Add the route shell and agent sidecar

- Use semantic controls for start, pause/resume, restart/replay, mode, and details disclosure.
- Mirror current intent, health change, and outcome in DOM status.
- Preserve geometry during asset loading; show a stable retryable error if required assets fail.
- Match the existing Living Village lab navigation and reduced-motion preference.

### 7. Expand art only after the first reviewable motion proof

- Create two additional original hero anchors in the same illustration quality with distinct
  silhouettes and roles.
- Create one original rat brute and one lesser-rat presentation.
- Give supporting heroes a smaller but coherent motion vocabulary; do not ship generic proxies.
- Store every selected project-bound asset and prompt with provenance.

### 8. Verify and hand off

- Run focused unit and browser tests, formatter, lint, typecheck, build, and web budget validation.
- Run the available premium UI static audit; document that its referenced auxiliary files are absent
  if the installation still cannot supply them.
- Inspect phone and desktop screenshots, reduced motion, keyboard controls, loading, retry, pause,
  replay, and both presentation modes.
- Bind the preview server to `0.0.0.0` and publish the collaborator URL with `10.110.24.218`.
- Commit only this worktree's in-scope changes and push `codex/realtime-combat-study`.
