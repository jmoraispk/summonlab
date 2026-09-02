# Result contract

The final file uses strict repository `SkillIconResultSchema` version `skill-icon-result-v1`.
Unknown fields are invalid.

## Required evidence

- `resultId`, `jobId`, and `assignmentId` bind the packet.
- `status` is `candidate`, `revise`, or `failed`—never `approved`.
- `exactPrompt` equals the immutable target string byte-for-byte; `promptHash` is its lowercase
  SHA-256 over UTF-8 bytes.
- `referenceInputs` exactly repeats every target reference path and hash in manifest order.
- `output` records the retained candidate or is `null` only for `failed`.
- `resultPath` and `writtenOutputPaths` name only the grant. With an output, the written tuple is
  `[candidatePath, resultPath]`; without one it is `[resultPath]`.
- `findings`, timestamps, and elapsed time report the job honestly.
- `noSharedFilesEdited` is exactly `true`; `selfPromoted` is exactly `false`.

Candidate output metadata must equal the retained bytes: versioned path, `image/png`, 1024×1024,
8-bit RGBA, byte count, and lowercase SHA-256. A candidate has no failed finding and includes both
automated and producer passes. Record the full-size geometry/alpha inspection and the producer's
96-pixel recognition inspection explicitly. `revise` retains an image and at least one concern or
failure. `failed` retains no image and supplies a failed finding or structured `failureReason`.

## Persistence and verification

Run `pnpm persist:skill-icon-output` with the explicit provider source, target, and assignment
paths. The helper validates and exclusively creates the exact candidate and initial result. Never
copy, rename, convert, or overwrite candidate bytes yourself.

The result schema intentionally has no attempt array. Supply the actual number of imagegen calls to
the verifier separately with `--attempt-count`; it must be `1..retryCeiling+1`. The verifier invokes
the live Zod execution contract, recomputes reference and candidate hashes, parses PNG structure,
rejects symlinks, compares the result argument with the owned result file, and requires the complete
Git change set to equal the result's one or two written paths.

If verification fails after this job newly created outputs, report the failure for coordinator
handling. Do not delete, replace, promote, or move evidence and do not touch shared files.
