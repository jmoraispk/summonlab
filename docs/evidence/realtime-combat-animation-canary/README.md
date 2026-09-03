# Realtime combat animation canary evidence

## Review source

The owner-approved combat screenshot supplied in the Codex task on 2026-09-03 remains reference-only
and is not copied into Git. The pre-canary realtime combat route is the implementation baseline.

## Review surfaces

- Desktop: 1440×1100 browser viewport.
- Phone: 390×844 browser viewport.
- Route: `/living-village-lab/realtime-combat`.
- Stable lens names: `2D`, `2.5D`, and `2.5D V2`.

## Canary acceptance checks

- Asha and one lesser rat visibly transition through idle, advance, attack, hit, and down animation.
- Asha is never horizontally mirrored; her right undercut and left braid stay authored.
- Health bars live in a screen-space layer and clear the visible head/ears by at least 12 logical px.
- `2D` keeps fixed actor scale and fixed team layer priority.
- `2.5D` preserves the original rectangular coordinates while enabling the original depth cues.
- `2.5D V2` alone applies trapezoidal lane convergence, nonlinear depth scale, directional shadows,
  a well foreground occluder, stronger bounded parallax, and visible cyan projection guides.
- Switching lenses while paused preserves elapsed time and never restarts or retargets the encounter.
- Reduced motion removes camera/parallax drift but retains the authored pose animation.

## Capture naming

Use `desktop-{lens}-{idle|advance|attack|hit|down}.png` and
`phone-{lens}-{idle|advance|attack|hit|down}.png`. Do not commit new captures until the owner selects
the canary direction; this keeps evidence review separate from runtime asset production.
