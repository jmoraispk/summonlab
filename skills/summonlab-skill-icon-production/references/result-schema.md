# Result contract

The final file uses the strict result schema matching its packet tuple: `skill-icon-result-v1` for
exact-source jobs, including current `skill-art` and `calibration-plate` work, and
`skill-icon-result-v2` for green-key `rarity-frame` and `backing` retries. Unknown fields and mixed
protocol versions are invalid.

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

Result-v2 also records a required discriminated `normalization` outcome. `completed` binds the
literal profile, raw geometry-file hash, pathless provider-source PNG media/dimensions/alpha/byte
count/hash, `sourceContentHash`, and `outputContentHash`. Source hash equals the provider evidence
hash; output hash equals the retained candidate hash. `failed` records honest observed source
metadata and no output hash; `not-run` has no source or output evidence. A retained `candidate` or
`revise` requires `completed`. A terminal result may record `completed` only when normalization
finished before a later validation or persistence failure. No normalization evidence has a provider
path field.

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

Run `pnpm persist:skill-icon-output` with the explicit provider source, target, and assignment paths;
v2 also requires the expected provider hash. The helper validates and exclusively creates the exact
candidate and initial result. V1 retains source bytes exactly. V2 reads the provider file once
through a no-follow descriptor and applies only its target-authorized deterministic profile inside
the same collision-safe transaction. Never copy, rename, convert, key, resize, mask, or overwrite
candidate bytes yourself.

The result schema intentionally has no attempt array. Supply the actual number of imagegen calls to
the verifier separately with `--attempt-count`; it must be `1..retryCeiling+1`. The verifier invokes
the live Zod execution contract, recomputes reference and candidate hashes, parses PNG structure,
rejects symlinks, compares the result argument with the owned result file, and requires the complete
Git change set to equal the result's one or two written paths.

When provider failure, throttle, timeout, malformed output, persistence, or validation leaves no
role-valid image, do not call the image persistence helper and do not fabricate a candidate. From a
clean preflight state, exclusive-create and immediately verify the result-only failure. For a v2
failure after provider bytes were received but deterministic normalization rejected them, add
`--normalization-source PROVIDER_PATH`; the helper stable-reads and hashes that source, records
pathless observed metadata with `normalization.outcome: "failed"`, and does not create a candidate.
Omit the flag when no provider bytes were received, which records
`normalization.outcome: "not-run"`:

```bash
python3 <skill-directory>/scripts/verify_result.py \
  TARGET ASSIGNMENT RESULT WORKSPACE_ROOT --attempt-count ACTUAL_CALLS \
  --write-failure --failure-kind FAILURE_KIND --failure-message "HONEST DETAIL" \
  --started-at ACTUAL_ISO_START \
  --completed-at ACTUAL_ISO_COMPLETION --total-wall-time-ms ACTUAL_ELAPSED_MS
```

For the observed-source v2 route, insert
`--normalization-source PROVIDER_PATH` before the timing flags.

This mode refuses either pre-existing output or any other repository change, writes only the
assigned result path with `output: null`, and verifies the strict execution and ownership contract.
`--normalization-source` is valid only for v2 packets and never persists the source path itself.
Supply the real start plus either completion or elapsed milliseconds; when both are supplied they
must agree exactly. The helper derives only the omitted value and rejects naive, reversed, or
inconsistent timing instead of synthesizing a zero-duration attempt. Derived completion preserves
sub-millisecond start precision, and final verification independently cross-checks elapsed time
against both timestamps for every result status.

If verification fails after this job newly created outputs, report the failure for coordinator
handling. Do not delete, replace, promote, or move evidence and do not touch shared files.
