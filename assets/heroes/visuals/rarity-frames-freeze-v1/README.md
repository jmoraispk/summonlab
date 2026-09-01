# Hero rarity frames v3 + v4 freeze

Status: **approved visual sources — frozen; runtime exports pending**.

This freeze records the owner-approved byte-level source set for hero rarity frames. It contains no
duplicated artwork: `checksums.sha256` binds the approved PNGs in the existing v3 and v4 provenance
packets.

- v3 owns the frozen comparison, neutral, and affinity authority;
- v4 owns the frozen gemless-neutral authority and five equal-canvas individual families;
- Wind rank 7 v2 is active; outward-facing Wind rank 7 v1 remains superseded provenance;
- all 48 approved PNG paths and hashes are listed in `checksums.sha256`;
- ADR 0066 owns the approval and immutability decision.

These sources are not transparent runtime exports and are not registered in any shared runtime
catalog. Runtime preparation requires a separate, explicit integration pass.
