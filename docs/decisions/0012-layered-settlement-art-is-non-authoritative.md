# ADR 0012: Layered settlement art is non-authoritative

Status: accepted on 2026-08-24 as an approval candidate.

## Context

`hearth-01-v1` already owns building identity, routes, travel time, capacity, and system access. A
painted settlement is needed for visual quality, but a single composited image cannot become the
source of navigation truth. The earlier settlement-scale character study also places the dormitory
and workshop on opposite sides from the versioned graph and remains behind the Phase 3 human gate.

## Decision

- `hearth-01-scene-v1` is a separate, human-pending visual definition bound to settlement content
  hash `83e2d404fa3e119bc02ff6ff1f82896ea8ffb10a2661f8c7b0e858a35eeb89b9` and scene hash
  `c88d39611eee5b3939008da8353e3625ac97615c01e24cd9de5c191e80eb06bc`.
- The original hero-free 1536×1024 PNG is generated with the built-in image tool. Its prompt and
  exact visual-style and spatial-layout reference hashes live with the scene definition.
- The plate follows the topology: gate north, kitchen west, dormant workshop east, dormitory
  southwest, training ground southeast, and an unobstructed shared courtyard.
- A content-addressed 296.2 KB WebP is the runtime asset. The source remains a review artifact; the
  runtime export uses 19.7% of its 1.5 MB budget.
- Rendering has six ordered layers: bitmap base, code atmosphere, code illumination, projected
  route, activity intent, and interface. Ambient motion freezes under reduced motion.
- Five keyboard-accessible hotspots and all 18 node projections are visual mappings only. The
  deterministic route plan supplies the selected nodes; neither the bitmap, hotspot bounds, route
  projection, nor cursor can commit arrival.
- `pnpm validate:settlement-scene` verifies source and runtime bytes, dimensions, SHA-256 hashes,
  content-addressed filename, two reference hashes, six layers, five hotspots, 18 projections, the
  five-place compass layout, and the exact topology binding.
- The route remains development-only and the scene remains `approval-candidate` until a human
  accepts or revises it. SET-003 must introduce a new versioned engine command/event boundary for
  authoritative travel without changing engine-v1 or engine-v2 history bytes.

## Consequences

Hearth 01 can now look inhabited and respond to route selection without confusing presentation with
simulation. Generated environment art can be replaced by a new scene version without rewriting
topology or replay history, and topology changes require an explicit new content and scene binding.

The current plate is a full-scene composition rather than physically separated bitmap planes.
Parallax, occupancy, task animation, day/night state, and character rigs remain code-owned later
layers under SET-008. Human review may still revise placement, lighting, labels, or visual emphasis.
