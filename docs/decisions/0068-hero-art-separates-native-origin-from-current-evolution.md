# 0068 — Hero art separates native origin from current evolution

**Status:** Accepted

**Date:** 2026-09-02

## Context

Hero visuals need believable relationships among physique, starting capability, hidden learning,
personality, history, clothing, and star progression. A native 5★ summon should feel rarer and more
singular than a native 1★ summon, while that same 1★ hero may eventually evolve through 5★ and 7★
without becoming a different person. AI image generation also prevents a manifest seed from
guaranteeing identical output pixels.

[ADR 0072](0072-four-attributes-and-operator-owned-combat-modes.md) now defines the current
mechanical separation: four visible combat attributes, a separate hidden learning profile, and
personality/history outside both. `character-v2` and `engine-v25` capability typing is shipped.

## Decision

- Hero production preserves a reproducible design manifest and exact approved image bytes. AI image
  rendering is stochastic candidate production, not a deterministic procedural-human generator.
- Native stars and current stars are separate visual inputs. Native stars influence the rarity and
  singularity of the starting composition; current stars drive identity-locked, visibly different
  evolution art.
- A nurtured low-native-star hero may earn equally singular high-rank presentation through history.
  Star rank never controls beauty, dignity, ethnicity, anatomical quality, or rendering quality.
- Physical traits may create probabilistic cues for Might, Vitality, or Agility. Spirit uses
  concrete authored practice, focus, clothing, history, and small-effect cues. Every valid
  four-attribute combination keeps nonzero probability; cues are fallible and never exact-stat,
  phenotype, or moral judgments.
- Hidden cognitive learning and the five domain scores—martial, magical, crafting, survival, and
  social—remain separate from combat attributes. Personality and history are separate again. Art
  may show observed practice or lived experience, but it must not expose hidden scores or turn them
  into anatomy.
- New hero art uses only the four combat attributes as attribute cues. Intellect, Dexterity, the
  obsolete five-category aptitude proposal, and the legacy four-score aptitude payload cannot
  direct new heroes or artwork.
- The v2/v25 capability schema and character generation are shipped. Paired visual-manifest fields
  that consume those typed mechanics have not yet been adopted; that art integration remains
  separately versioned future work and does not mutate existing approved image bytes or replay.

## Supersession update

[ADR 0072](0072-four-attributes-and-operator-owned-combat-modes.md) supersedes this record's former
Intellect/Dexterity visual cues, five-category aptitude authority, and claim that the shared runtime
still lacked a replacement capability type. Native-versus-current star identity, dignity, visual
continuity, approved-byte ownership, and stochastic-candidate rules remain accepted.

## Consequences

The Heroes team can create manifest-bound candidates, wardrobe studies, evolution sheets, prompts,
and provenance without waiting for paired-manifest capability-field adoption. Approved full-body
art becomes the source for roster and combat derivatives; independently generated views cannot
redefine identity.

The art integration owner must eventually add an explicit versioned bridge from the shipped
capability profile to any paired visual-manifest fields that need it. Until then, approved hero art
continues to bind identity without inventing attribute or learning data, and historical records keep
their original payloads.
