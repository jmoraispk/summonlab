# 0048 — Sensory presentation is local and redundant

**Status:** Accepted
**Date:** 2026-08-25

## Decision

Sound, captions, focus, and cinematic interface effects form a browser-only presentation layer.
They may respond to a route or an already-visible player action, but they never submit engine
commands, append events, change campaign metadata, or participate in replay verification.

The first soundscape is procedural and license-free. One Web Audio graph supplies quiet route-based
profiles for the title, summoning gate, Hearth, and tower surfaces. Full mix adds short action cues;
Ambient omits those cues; Muted is the default. A user gesture must activate or resume the audio
context, so a persisted non-muted preference returns as **Sound ready** rather than bypassing browser
autoplay policy.

No sound carries unique game information. Every interface cue has a short optional text equivalent,
enabled by default, and all consequential state remains readable in the existing interface and
journal. Cue-triggered light treatment is decorative. Reduced motion replaces animated flares with
a brief static emphasis, and System motion follows the operating-system preference unless the player
explicitly selects Full.

Player preferences move to `summonlab.player-settings.v2`. The loader migrates the FIN-003 v1
reading, motion, and decision-timing fields while defaulting sound to Muted and captions to on.
Settings are applied in the document head before hydration to avoid a large-text or motion flash.

The same layer establishes the vertical-slice accessibility baseline: a skip link and visible global
focus ring, route-level scroll/focus reset, native radio and checkbox settings controls, arrow-key
hero tabs, modal focus containment, Escape close, and focus restoration. Forced-colors mode is left
to platform colors instead of locking decorative palette values.

## Consequences

- Replaying the same chronicle may produce different wall-clock audio timing without changing a
  single canonical byte; audio is atmosphere, not replay evidence.
- No downloadable or generated audio asset enters the runtime budget in FIN-004. Later authored
  audio can replace the procedural graph behind the same local boundary and preference contract.
- New essential information must be represented in text/state first. Adding a sound-only warning is
  an architecture violation even when captions are available.
- UI elements opt into cues through typed `data-sound-cue` values. The sensory layer observes the
  resulting interaction but cannot make it legal or successful.
- Modal and route focus behavior is now browser-tested alongside the complete campaign journey at
  desktop and 390×844 phone dimensions.
