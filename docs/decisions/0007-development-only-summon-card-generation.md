# ADR 0007: Summon-card generation is explicit, ephemeral, and non-canonical

Status: accepted on 2026-08-23.

## Context

A cinematic summon card can benefit from a reference-driven image model, but a generated image must
not redefine physical identity, mutate game state, consume money unexpectedly, or become approved
merely because a provider returned it. The experiment also needs enough provenance to reproduce and
review the exact request later.

The [official OpenAI image-generation guide](https://developers.openai.com/api/docs/guides/image-generation)
recommends the Image API for one-shot generation or editing, documents base64 image output, and
supports low-quality portrait drafts. The
[GPT-Image-2 model page](https://developers.openai.com/api/docs/models/gpt-image-2) identifies
`gpt-image-2-2026-04-21` as a pinned snapshot with image generation and edit endpoints.

## Decision

- The experiment uses one `images/edits` request with the exact catalog anchor as its reference.
- The default snapshot is `gpt-image-2-2026-04-21`, with `low`, `1024x1536`, PNG output,
  automatic moderation, and exactly one candidate. The dated output estimate is $0.005 USD; prompt
  and reference-image input tokens are explicitly excluded.
- The server authors the prompt from the immutable manifest, identity locks, and optional subordinate
  player direction. The client cannot choose the model, endpoint, candidate count, moderation, or
  persistence behavior.
- Before execution, the server matches catalog version, asset key, asset hash, and manifest hash,
  then rereads the reference and verifies its byte count and SHA-256.
- Provider execution requires development routes, `ENABLE_IMAGE_GENERATION=true`, a local
  `OPENAI_API_KEY`, a verified cost estimate, and an explicit per-request cost acknowledgement.
- The adapter performs no automatic retry. Timeouts, rate limits, moderation/user failures, and
  provider failures require a new explicit request so an uncertain response cannot double-spend.
- The provider response is validated as PNG, hashed, and returned as base64 with a provider request
  ID when available. It is not written to disk, PostgreSQL, the visual catalog, or engine state.
- Generated output is always `canonical: false` and `ephemeral-response-only`. Promotion into the
  visual catalog requires a separate future asset-normalization and human-review flow.
- Automated tests use an injected provider mock. This checkpoint makes no paid API call and does not
  require a key.

## Consequences

The team can inspect and refine the exact card prompt immediately while paid execution remains off.
Enabling the experiment later is a deliberate local act with a visible one-candidate cost boundary.
The request and output hashes provide review provenance without weakening deterministic replay or
letting generated pixels become game truth.
