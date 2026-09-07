# Result schema

The producer writes one temporary `summonlab-skill-art-result-v1` JSON document.

Required fields:

- matching `jobId` and `targetId`;
- `status`: `candidate` or `failed`;
- exact `promptHash` and ordered `referenceInputs` copied from the target;
- `candidate`: path, SHA-256, byte count, width, height, and `rgba` alpha mode, or `null` for
  failure;
- `findings`: `fullSize` and `recognition96`, each with `pass` or `fail` plus a concrete
  observation;
- `attemptCount` within the assignment limit;
- `noSharedFilesEdited: true` and `selfPromoted: false`.

A candidate is exactly 1024x1024 non-interlaced RGBA PNG, contains visible artwork, and has a fully
transparent canvas boundary. The verifier checks those raster properties rather than trusting the
written findings. Absence of baked frame traces remains an explicit visual-review decision. A
failed result retains no candidate. Candidate means ready for owner review, never approved.
