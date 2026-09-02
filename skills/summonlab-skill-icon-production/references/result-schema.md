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

Candidate output metadata must equal the retained bytes: versioned path, target media type and
dimensions, alpha mode, byte count, and lowercase SHA-256. Verification invokes the repository's
`inspectSkillIconAsset`: individual artwork must satisfy visible-area, safe-zone, exclusion, and
alpha rules; frames must satisfy aperture and six-edge registration; backings must satisfy aperture
coverage; calibration plates use their declared canvas and may be RGB. A candidate has no concern
or failure and explicitly passes both required views; unrelated role-inapplicable findings may
remain `not-applicable`. Every retained `candidate` or `revise` records automated full-size geometry
evidence and producer 96-pixel recognition evidence; `revise` also records at least one concern or
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

When provider failure, throttle, timeout, malformed output, persistence, or validation leaves no
role-valid image, do not call the image persistence helper and do not fabricate a candidate. From a
clean preflight state, exclusive-create and immediately verify the result-only failure:

```bash
python3 <skill-directory>/scripts/verify_result.py \
  TARGET ASSIGNMENT RESULT WORKSPACE_ROOT --attempt-count ACTUAL_CALLS \
  --write-failure --failure-kind FAILURE_KIND --failure-message "HONEST DETAIL" \
  --started-at ACTUAL_ISO_START \
  --completed-at ACTUAL_ISO_COMPLETION --total-wall-time-ms ACTUAL_ELAPSED_MS
```

This mode refuses either pre-existing output or any other repository change, writes only the
assigned result path with `output: null`, and verifies the strict execution and ownership contract.
Supply the real start plus either completion or elapsed milliseconds; when both are supplied they
must agree exactly. The helper derives only the omitted value and rejects naive, reversed, or
inconsistent timing instead of synthesizing a zero-duration attempt. Derived completion preserves
sub-millisecond start precision, and final verification independently cross-checks elapsed time
against both timestamps for every result status.

If verification fails after this job newly created outputs, report the failure for coordinator
handling. Do not delete, replace, promote, or move evidence and do not touch shared files.
