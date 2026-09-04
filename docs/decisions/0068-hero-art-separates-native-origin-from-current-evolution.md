# 0068 — Hero art separates native origin from current evolution

**Status:** Accepted

**Date:** 2026-09-02

## Context

Hero visuals need believable relationships among physique, starting capability, aptitude,
personality, clothing, and star progression. A native 5★ summon should feel rarer and more singular
than a native 1★ summon, while that same 1★ hero may eventually evolve through 5★ and 7★ without
becoming a different person. AI image generation also prevents a manifest seed from guaranteeing
identical output pixels.

The accepted progression wiki defines five concrete aptitude categories. The implemented character
contract still exposes an older four-score `might`, `finesse`, `insight`, and `resolve` payload that
does not map cleanly to the accepted mechanics.

## Decision

- Hero production preserves a reproducible design manifest and exact approved image bytes. AI image
  rendering is stochastic candidate production, not a deterministic procedural-human generator.
- Native stars and current stars are separate visual inputs. Native stars influence the rarity and
  singularity of the starting composition; current stars drive identity-locked, visibly different
  evolution art.
- A nurtured low-native-star hero may earn equally singular high-rank presentation through history.
  Star rank never controls beauty, dignity, ethnicity, anatomical quality, or rendering quality.
- Physical traits create probabilistic cues for starting physical attributes. Every valid attribute
  and aptitude combination keeps nonzero probability; extreme contradictions are very rare rather
  than mechanically impossible.
- Intellect, Spirit, Dexterity, and other less directly bodily traits use concrete pose, clothing,
  grooming, life-history, and small-effect cues. These are fallible proxies, never phenotype or
  moral judgments and never exact-stat disclosure.
- New hero content uses only Attribute, Family, Learning mode, Variety, and Affinity aptitudes. The
  legacy four-score aptitude payload is superseded, compatibility-only technical debt and cannot be
  used as authority for new heroes or artwork.
- Replacing the shared runtime payload requires a separately reviewed versioned integration. This
  visual decision does not silently mutate engine contracts, replay snapshots, policies, or runtime
  catalogs.

## Consequences

The Heroes team can create manifest-bound candidates, wardrobe studies, evolution sheets, prompts,
and provenance without waiting for the shared runtime migration. Approved full-body art becomes the
source for roster and combat derivatives; independently generated views cannot redefine identity.

The cross-system integration owner must eventually remove active reliance on the legacy aptitude
scores, introduce typed aptitude targets and magnitudes, update consumers, and preserve historical
replay readability. No automatic four-to-five mapping is authoritative.
