# Result contract

Write one JSON result at the assignment's owned result path. Use
`schemaVersion: image-production-result-v1`.

Required fields:

- `resultId`, `targetId`, `assignmentId`, and `skillVersion` bind the result to its inputs.
- `status` is `candidate`, `revise`, or `failed`.
- `attempts` contains one entry per actual generation call, never more than `retryCeiling + 1`.
- `selectedAttemptId` identifies the producer-accepted attempt for a candidate and is otherwise null.
- `failedCriteria` contains only criterion IDs declared by the target.
- `writtenOutputPaths` contains no path outside the assignment.
- `noSharedFilesEdited: true` and `selfPromoted: false` are agent attestations which the orchestrator
  independently audits against the wave's actual changes.
- `failedCriteria` lists acceptance IDs that did not pass.
- `startedAt`, `completedAt`, and `totalWallTimeMs` describe the complete job boundary.

Each attempt records:

- stable `attemptId`, one-based `attemptNumber`, and `precedingAttemptId` linkage;
- request, generation-completion, and inspection-completion timestamps;
- generation, inspection, and total wall times;
- `conclusion`: producer accepted, producer rejected, or provider failure;
- exact prompt plus prompt SHA-256;
- `referenceInputs`: the complete target-declared reference provenance in manifest order, retained
  on every attempt even when a corrective edit uses only the preceding render as its tool input;
- `correctionReferenceInput`: the exact absolute source path and hash of a preceding generated image
  supplied for an edit, or null/omitted when no generated-image correction reference was used;
- nonempty `sourceOutputId`, the complete persistence-helper receipt, and output metadata when an image was returned;
- `persistence.retained` must exactly equal `output`; retain the source path, dimensions, media type, byte count, and hash so normalization is auditable;
- criterion-bound findings and a retry reason when rejected.

Finding outcomes are `pass`, `concern`, `fail`, or `not-applicable`. A `concern` preserves a
non-blocking visual caveat without disguising it as a pass; every required objective authoring gate
must still have an explicit producer or automated `pass` for `candidate` status.

If the first prompt differs by even one byte from the canonical renderer, do not falsify or discard
the evidence. A semantic-v2 job must retain any useful review image as `revise`, fail the declared
`protocol-provenance` criterion, record the exact text and hash actually submitted, and stop at the
assignment retry ceiling. Such an image is never a candidate.

The selected prompt, source output, timings, file metadata, and hash must describe the saved file.
Do not invent missing provenance. Prompts and clock boundaries are agent-recorded provenance unless
the tool returns an independently bindable receipt; document that limitation in aggregate evidence.

The verifier checks structure, IDs, ownership, attempt limits, timestamps, prompt and image hashes,
candidate decision consistency, dimensions, and reference integrity. It does not prove blind visual
recognition, actual absence of shared edits, originality, or human approval.
